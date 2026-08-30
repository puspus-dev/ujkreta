package main

import (
	"encoding/json"
	"net/http"
)

// handleAdminStudents – GET lista, POST új diák (+ opcionális login user).
// A registerAdminRoutes-ban:
//   mux.HandleFunc("/admin/students", s.requireAdmin(s.handleAdminStudents))
func (s *Server) handleAdminStudents(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.ListStudents())

	case http.MethodPost:
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
			if _, err := s.store.CreateUserWithRole(
				body.Username,
				body.Password,
				body.Student.Uid,
				"Tanulo",
			); err != nil {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "user_create: " + err.Error(),
				})
				return
			}
		}
		writeJSON(w, http.StatusCreated, map[string]any{
			"success": true,
			"student": body.Student,
		})

	default:
		methodNotAllowed(w, "GET, POST")
	}
}
