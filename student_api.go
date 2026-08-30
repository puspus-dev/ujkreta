package main

import (
	"net/http"
)

// ============================================================
// DIÁK API – session alapján szűrt adatok
//
// A meglévő handleGet* helyett / mellett ezeket használd,
// miután a requireAuth beteszi a sessiont a contextbe.
// ============================================================

func (s *Server) handleGetStudentScoped(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	sess, ok := sessionFromRequest(r)
	if !ok || sess.UserID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error": "invalid_token",
		})
		return
	}

	// Tanár ne a diák adatlapot kapja ezen az endpointon
	if sess.Role == RoleTeacher {
		writeJSON(w, http.StatusForbidden, map[string]string{
			"error":   "forbidden",
			"message": "Tanár fiók – használd a /naplo/v3/sajat/TanarAdatlap endpointot.",
		})
		return
	}

	st, err := s.store.GetStudentByUID(sess.UserID)
	if err != nil {
		// fallback singleton
		st = s.store.GetStudent()
	}

	writeJSON(w, http.StatusOK, st)
}

func (s *Server) handleGetGradesScoped(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	sess, ok := sessionFromRequest(r)
	if !ok || sess.UserID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid_token"})
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetGradesForStudent(sess.UserID))
}

func (s *Server) handleGetOmissionsScoped(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	sess, ok := sessionFromRequest(r)
	if !ok || sess.UserID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid_token"})
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetOmissionsForStudent(sess.UserID))
}

func (s *Server) handleGetHomeworkScoped(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	sess, ok := sessionFromRequest(r)
	if !ok || sess.UserID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid_token"})
		return
	}

	classUID := s.store.GetStudentClassGroupUID(sess.UserID)
	writeJSON(w, http.StatusOK, s.store.GetHomeworkForClass(classUID))
}

func (s *Server) handleGetTimeTableScoped(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	sess, ok := sessionFromRequest(r)
	if !ok || sess.UserID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid_token"})
		return
	}

	classUID := s.store.GetStudentClassGroupUID(sess.UserID)
	writeJSON(w, http.StatusOK, s.store.GetLessonsForClass(classUID))
}

func (s *Server) handleGetTestsScoped(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	sess, ok := sessionFromRequest(r)
	if !ok || sess.UserID == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid_token"})
		return
	}

	classUID := s.store.GetStudentClassGroupUID(sess.UserID)
	writeJSON(w, http.StatusOK, s.store.GetTestsForClass(classUID))
}

func (s *Server) handleGetClassGroupsScoped(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	// Osztálylista: diák csak a sajátját, vagy mindet (mock / kis iskola)
	// Egyszerű MVP: az összes aktív csoport
	writeJSON(w, http.StatusOK, s.store.GetClassGroups())
}
