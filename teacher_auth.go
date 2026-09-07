package main

import (
	"net/http"
)

// requireTeacher – Tanar VAGY Osztalyfonok (napló API).
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
		// Tanár + osztályfőnök
		if role != RoleTeacher && role != "Tanar" && role != RoleOsztalyfonok && role != "Osztalyfonok" {
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error": "teacher_or_of_only",
				"hint":  "Tanar vagy Osztalyfonok szerepkör kell",
			})
			return
		}
		next(w, r)
	})
}
