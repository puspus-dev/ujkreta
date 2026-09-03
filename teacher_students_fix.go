package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"encoding/json"
)

// ============================================================
// FONTOS: a teacher_store.go-ból TÖRÖLD a régi GetTeacherStudents
// függvényt, különben "redeclared" build hiba.
// ============================================================

// GetTeacherStudents – minden aktív diák (ListStudents), nem csak 1 seed.
func (s *Store) GetTeacherStudents() []TeacherStudent {
	students := s.ListStudents()
	groups := s.GetClassGroups()
	groupByUID := map[string]string{}
	for _, g := range groups {
		groupByUID[g.Uid] = g.Nev
	}

	out := make([]TeacherStudent, 0, len(students))
	for _, st := range students {
		classUID := s.GetStudentClassGroupUID(st.Uid)
		className := groupByUID[classUID]
		if className == "" {
			className = classUID
		}
		if classUID == "" && len(groups) > 0 {
			classUID = groups[0].Uid
			className = groups[0].Nev
		}
		out = append(out, TeacherStudent{
			Uid:      st.Uid,
			Nev:      st.Nev,
			EmailCim: st.EmailCim,
			OsztalyCsoport: NameUid{
				Uid: classUID,
				Nev: className,
			},
		})
	}
	return out
}

func (s *Store) DeleteGrade(uid string) error {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return fmt.Errorf("uid_required")
	}
	grades := s.GetGrades()
	filtered := make([]Grade, 0, len(grades))
	for _, g := range grades {
		if g.Uid == uid {
			continue
		}
		filtered = append(filtered, g)
	}
	s.SetGrades(filtered)
	ctx := context.Background()
	_, _ = s.db.Exec(ctx, `DELETE FROM grades WHERE uid = $1 OR data->>'Uid' = $1`, uid)
	return nil
}

func (s *Store) DeleteOmission(uid string) error {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return fmt.Errorf("uid_required")
	}
	list := s.GetOmissions()
	filtered := make([]Omission, 0, len(list))
	for _, o := range list {
		if o.Uid == uid {
			continue
		}
		filtered = append(filtered, o)
	}
	s.SetOmissions(filtered)
	ctx := context.Background()
	_, _ = s.db.Exec(ctx, `DELETE FROM omissions WHERE uid = $1 OR data->>'Uid' = $1`, uid)
	return nil
}

func (s *Store) HardDeleteStudent(uid string) error {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return fmt.Errorf("uid_required")
	}
	ctx := context.Background()
	_, err := s.db.Exec(ctx, `DELETE FROM students WHERE uid = $1`, uid)
	if err != nil {
		return err
	}
	_, _ = s.db.Exec(ctx, `DELETE FROM users WHERE student_uid = $1`, uid)
	return nil
}

func (s *Store) HardDeleteUserByUsername(username string) error {
	username = strings.TrimSpace(username)
	if username == "" {
		return fmt.Errorf("username_required")
	}
	ctx := context.Background()
	_, err := s.db.Exec(ctx, `DELETE FROM users WHERE username = $1`, username)
	return err
}

// handleTeacherGrades – GET + POST + DELETE
func (s *Server) handleTeacherGrades(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.GetGrades())
	case http.MethodPost:
		var req createGradeRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
			return
		}
		grade, err := s.store.AddGrade(req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "grade_create_failed", "message": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, grade)
	case http.MethodDelete:
		uid := strings.TrimSpace(r.URL.Query().Get("uid"))
		if uid == "" {
			var body struct{ Uid string `json:"uid"` }
			_ = json.NewDecoder(r.Body).Decode(&body)
			uid = strings.TrimSpace(body.Uid)
		}
		if uid == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "uid_required"})
			return
		}
		if err := s.store.DeleteGrade(uid); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "deleted": uid})
	default:
		methodNotAllowed(w, "GET, POST, DELETE")
	}
}

// handleTeacherOmissions – GET + POST + DELETE
func (s *Server) handleTeacherOmissions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.GetOmissions())
	case http.MethodPost:
		var req createOmissionRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
			return
		}
		om, err := s.store.AddOmission(req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "omission_create_failed", "message": err.Error()})
			return
		}
		writeJSON(w, http.StatusCreated, om)
	case http.MethodDelete:
		uid := strings.TrimSpace(r.URL.Query().Get("uid"))
		if uid == "" {
			var body struct{ Uid string `json:"uid"` }
			_ = json.NewDecoder(r.Body).Decode(&body)
			uid = strings.TrimSpace(body.Uid)
		}
		if uid == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "uid_required"})
			return
		}
		if err := s.store.DeleteOmission(uid); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "deleted": uid})
	default:
		methodNotAllowed(w, "GET, POST, DELETE")
	}
}
