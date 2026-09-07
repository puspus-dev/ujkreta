package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
	"context"
)

// ============================================================
// OSZTÁLYFŐNÖK ROLE + tanári API hozzáférés
//
// 1) teacher_auth.go: TÖRÖLD a régi requireTeacher-t (ez a fájl adja)
// 2) store_users.go CreateUserWithRole: role check legyen:
//      role == RoleStudent || role == RoleTeacher || role == "Osztalyfonok"
// ============================================================

const RoleOsztalyfonok = "Osztalyfonok"

func (s *Server) requireTeacher(next http.HandlerFunc) http.HandlerFunc {
	return s.requireAuthSession(func(w http.ResponseWriter, r *http.Request) {
		info, ok := sessionFromContext(r.Context())
		if !ok {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		role := info.Role
		if role == "" {
			role = "Tanulo"
		}
		if role != RoleTeacher && role != "Tanar" && role != RoleOsztalyfonok {
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error": "teacher_or_of_only",
			})
			return
		}
		next(w, r)
	})
}

// OF diák lista + létrehozás (Bearer Tanar/OF token)
func (s *Server) registerOFRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/naplo/v3/sajat/Of/Diakok", s.requireTeacher(s.handleOFStudents))
	mux.HandleFunc("/naplo/v3/sajat/Of/Users", s.requireTeacher(s.handleOFUsers))
}

func (s *Server) handleOFStudents(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.ListStudents())
	case http.MethodPost, http.MethodPut:
		var body struct {
			Student       Student `json:"student"`
			ClassGroupUID string  `json:"classGroupUid"`
			Username      string  `json:"username"`
			Password      string  `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
			return
		}
		if strings.TrimSpace(body.Student.Uid) == "" || strings.TrimSpace(body.Student.Nev) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "uid_and_name_required"})
			return
		}
		if err := s.store.UpsertStudent(body.Student, body.ClassGroupUID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if body.Username != "" && body.Password != "" {
			if _, err := s.store.CreateUserWithRoleOF(body.Username, body.Password, body.Student.Uid, "Tanulo"); err != nil {
				writeJSON(w, http.StatusOK, map[string]any{
					"success": true,
					"student": body.Student,
					"userWarning": err.Error(),
				})
				return
			}
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "student": body.Student})
	case http.MethodDelete:
		uid := strings.TrimSpace(r.URL.Query().Get("uid"))
		if uid == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "uid_required"})
			return
		}
		_ = s.store.SoftDeleteStudent(uid)
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "deleted": uid})
	default:
		methodNotAllowed(w, "GET, POST, PUT, DELETE")
	}
}

func (s *Server) handleOFUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}
	var req struct {
		Username   string `json:"username"`
		Password   string `json:"password"`
		StudentUID string `json:"studentUid"`
		Role       string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	// OF csak diák usert hozhat létre
	role := req.Role
	if role == "" {
		role = "Tanulo"
	}
	if role != "Tanulo" && role != RoleStudent {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "of_only_student_users"})
		return
	}
	user, err := s.store.CreateUserWithRoleOF(req.Username, req.Password, req.StudentUID, RoleStudent)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

// CreateUserWithRoleOF – Tanulo / Tanar / Osztalyfonok
func (s *Store) CreateUserWithRoleOF(username, password, linkedUID, role string) (User, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return User{}, fmt.Errorf("username/password kötelező")
	}
	if role == "" {
		role = RoleStudent
	}
	allowed := role == RoleStudent || role == "Tanulo" ||
		role == RoleTeacher || role == "Tanar" ||
		role == RoleOsztalyfonok
	if !allowed {
		return User{}, fmt.Errorf("érvénytelen role")
	}
	if role == "Tanulo" {
		role = RoleStudent
	}
	if role == "Tanar" {
		role = RoleTeacher
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, err
	}
	ctx := context.Background()
	var user User
	var roleOut string
	err = s.db.QueryRow(ctx, `
		INSERT INTO users (username, password_hash, student_uid, role, active)
		VALUES ($1, $2, $3, $4, TRUE)
		ON CONFLICT (username) DO UPDATE SET
			password_hash = EXCLUDED.password_hash,
			student_uid = COALESCE(NULLIF(EXCLUDED.student_uid, ''), users.student_uid),
			role = EXCLUDED.role,
			active = TRUE
		RETURNING id::text, username, password_hash, student_uid, role, active, created_at
	`, username, string(hash), linkedUID, role).Scan(
		&user.ID, &user.Username, &user.PasswordHash, &user.StudentUID, &roleOut, &user.Active, &user.CreatedAt,
	)
	if err != nil {
		return User{}, err
	}
	user.Role = roleOut
	return user, nil
}
