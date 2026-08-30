package main

import (
	"net/http"
)

// requireTeacher – bejelentkezett user, Role == Tanar (vagy legacy token).
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
		// Tanár UI + napló API
		if role != RoleTeacher && role != "Tanar" {
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error": "teacher_only",
				"hint":  "TEACHER_USERNAME / TEACHER_PASSWORD userrel lépj be",
			})
			return
		}
		next(w, r)
	})
}
