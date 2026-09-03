package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
)

// ============================================================
// STORE: soft-delete diák, tanár lista segéd
// Másold a multiuser_store.go / project mellé, vagy told be.
// ============================================================

func (s *Store) DeleteStudent(uid string) error {
	ctx := context.Background()
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return errString("uid_required")
	}
	_, err := s.db.Exec(
		ctx,
		`UPDATE students SET active = FALSE, updated_at = NOW() WHERE uid = $1`,
		uid,
	)
	return err
}

func (s *Store) DeactivateUserByStudentUID(uid string) error {
	ctx := context.Background()
	_, err := s.db.Exec(
		ctx,
		`UPDATE users SET active = FALSE WHERE student_uid = $1`,
		uid,
	)
	return err
}

type errString string

func (e errString) Error() string { return string(e) }

// ============================================================
// ADMIN: /admin/students – bővített GET/POST/DELETE/PUT
// Cseréld a handleAdminStudents-t erre (vagy regisztráld külön).
// ============================================================

func (s *Server) handleAdminStudentsCRUD(w http.ResponseWriter, r *http.Request) {
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
		if body.Student.Uid == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "student.uid_required"})
			return
		}
		if err := s.store.UpsertStudent(body.Student, body.ClassGroupUID); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if body.Username != "" && body.Password != "" {
			if _, err := s.store.CreateUserWithRole(body.Username, body.Password, body.Student.Uid, "Tanulo"); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_create: " + err.Error()})
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
		if err := s.store.DeleteStudent(uid); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		_ = s.store.DeactivateUserByStudentUID(uid)
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "deleted": uid})

	default:
		methodNotAllowed(w, "GET, POST, PUT, DELETE")
	}
}

// Tanár törlés: ha a singleton egyezik, üres profilra állítjuk.
func (s *Server) handleAdminTeacherDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		methodNotAllowed(w, "DELETE")
		return
	}
	uid := strings.TrimSpace(r.URL.Query().Get("uid"))
	t := s.store.GetTeacher()
	if uid != "" && t.Uid != "" && t.Uid != uid {
		writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "nem az aktív szerver-tanár; csak kliens oldalon törölhető",
			"uid":     uid,
		})
		return
	}
	// üres tanár
	s.store.SetTeacher(Teacher{Uid: ""})
	if uid != "" {
		_ = s.store.DeactivateUserByStudentUID(uid)
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "deleted": uid})
}

// main/registerAdminRoutes-ba:
//   mux.HandleFunc("/admin/students", s.requireAdmin(s.handleAdminStudentsCRUD))
//   mux.HandleFunc("/admin/teacher/delete", s.requireAdmin(s.handleAdminTeacherDelete))
// vagy a meglévő /admin/teacher DELETE ág.
