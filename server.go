package main

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

// ============================================================
// JSON HELPERS
// ============================================================

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(value)
}

func methodNotAllowed(w http.ResponseWriter, allowed string) {
	w.Header().Set("Allow", allowed)

	writeJSON(w, http.StatusMethodNotAllowed, map[string]string{
		"error": "method_not_allowed",
	})
}

// ============================================================
// STUDENT API
// ============================================================

func (s *Server) handleGetStudent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetStudent())
}

// ============================================================
// CLASS GROUPS
// ============================================================

func (s *Server) handleGetClassGroups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetClassGroups())
}

// ============================================================
// NOTICE BOARD
// ============================================================

func (s *Server) handleGetNoticeBoard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetNotices())
}

// ============================================================
// INFO BOARD
// ============================================================

func (s *Server) handleGetInfoBoard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetInfoBoard())
}

// ============================================================
// GRADES
// ============================================================

func (s *Server) handleGetGrades(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetGrades())
}

// ============================================================
// CLASS GROUP AVERAGES
// ============================================================

func (s *Server) handleGetClassGroupAverages(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetAverages())
}

// ============================================================
// TIMETABLE
// ============================================================

func (s *Server) handleGetTimeTable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetLessons())
}

// ============================================================
// OMISSIONS
// ============================================================

func (s *Server) handleGetOmissions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetOmissions())
}

// ============================================================
// HOMEWORK
// ============================================================

func (s *Server) handleGetHomework(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetHomework())
}

// ============================================================
// TESTS
// ============================================================

func (s *Server) handleGetTests(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetTests())
}

// ============================================================
// DKT
// ============================================================

func (s *Server) handleGetDktSubjects(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetDktSubjects())
}

// ============================================================
// ADMIN AUTH MIDDLEWARE
// ============================================================

func (s *Server) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		adminUsername := strings.TrimSpace(
			os.Getenv("ADMIN_USERNAME"),
		)

		adminPassword := os.Getenv("ADMIN_PASSWORD")

		if adminUsername == "" || adminPassword == "" {
			writeJSON(w, http.StatusForbidden, map[string]string{
				"error": "admin_disabled",
			})

			return
		}

		username, password, ok := r.BasicAuth()

		if !ok {
			w.Header().Set(
				"WWW-Authenticate",
				`Basic realm="admin"`,
			)

			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "admin_auth_required",
			})

			return
		}

		if username != adminUsername || password != adminPassword {
			w.Header().Set(
				"WWW-Authenticate",
				`Basic realm="admin"`,
			)

			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "invalid_admin_credentials",
			})

			return
		}

		next(w, r)
	}
}

// ============================================================
// ADMIN ROUTES
// ============================================================

func (s *Server) registerAdminRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/admin", s.requireAdmin(s.handleAdminIndex))
	mux.HandleFunc("/admin/health", s.requireAdmin(s.handleAdminHealth))
	mux.HandleFunc("/admin/config", s.requireAdmin(s.handleAdminConfig))
	mux.HandleFunc("/admin/student", s.requireAdmin(s.handleAdminStudent))
	mux.HandleFunc("/admin/reset", s.requireAdmin(s.handleAdminReset))
	mux.HandleFunc("/admin/users", s.requireAdmin(s.handleAdminUsers))
	mux.HandleFunc("/admin/teacher", s.requireAdmin(s.handleAdminTeacher))
	mux.HandleFunc("/admin/students", s.requireAdmin(s.handleAdminStudents))
}

// ============================================================
// ADMIN INDEX
// ============================================================

func (s *Server) handleAdminIndex(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"name":    "mock-kreta-server admin API",
		"version": 1,
		"status":  "ok",
		"routes": []string{
			"/admin",
			"/admin/health",
			"/admin/config",
			"/admin/student",
			"/admin/reset",
			"/admin/users",
		},
	})
}

// ============================================================
// ADMIN HEALTH
// ============================================================

func (s *Server) handleAdminHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
	})
}

// ============================================================
// ADMIN CONFIG
// ============================================================

func (s *Server) handleAdminConfig(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(
			w,
			http.StatusOK,
			s.store.GetConfig(),
		)

	case http.MethodPut, http.MethodPost:
		var config ServerConfig

		if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "invalid_json",
			})

			return
		}

		s.store.SetConfig(config)

		writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"config":  s.store.GetConfig(),
		})

	default:
		methodNotAllowed(w, "GET, PUT, POST")
	}
}

// ============================================================
// ADMIN STUDENT
// ============================================================

func (s *Server) handleAdminStudent(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(
			w,
			http.StatusOK,
			s.store.GetStudent(),
		)

	case http.MethodPut, http.MethodPost:
		var student Student

		if err := json.NewDecoder(r.Body).Decode(&student); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "invalid_json",
			})

			return
		}

		s.store.SetStudent(student)

		writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"student": s.store.GetStudent(),
		})

	default:
		methodNotAllowed(w, "GET, PUT, POST")
	}
}

// ============================================================
// ADMIN RESET
// ============================================================

func (s *Server) handleAdminReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}

	s.store.Reset()

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "A mock adatok vissza lettek állítva.",
	})
}

// ============================================================
// ADMIN USERS
// ============================================================

type createUserRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	StudentUID string `json:"studentUid"`
	Role       string `json:"role"`
}

func (s *Server) handleAdminUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}

	var req createUserRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid_json",
		})

		return
	}

	studentUID := strings.TrimSpace(req.StudentUID)

	if studentUID == "" {
		studentUID = s.store.GetStudent().Uid
	}

	role := req.Role
	if role == "" {
		role = "Tanulo"
	}
	user, err := s.store.CreateUserWithRole(
		req.Username,
		req.Password,
		studentUID,
		role,
	)

	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "user_creation_failed",
			"message": err.Error(),
		})

		return
	}

	writeJSON(w, http.StatusCreated, user)
}