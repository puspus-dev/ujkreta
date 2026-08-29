```go
package main

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
)

// ============================================================
// ADMIN AUTH
// ============================================================
//
// Az admin API egyszerű jelszavas védelmet használ.
//
// Renderen állítsd be:
//
// ADMIN_PASSWORD=valami-hosszú-admin-jelszó
//
// A kliens az alábbi headert küldi:
//
// X-Admin-Password: ...
//
// ============================================================

func (s *Server) requireAdmin(
	next http.HandlerFunc,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		password := os.Getenv("ADMIN_PASSWORD")

		// Ha nincs beállítva admin jelszó, az admin API
		// biztonsági okból ne legyen használható.
		if password == "" {
			writeAdminError(
				w,
				http.StatusServiceUnavailable,
				"Az admin felület nincs konfigurálva.",
			)
			return
		}

		provided := r.Header.Get("X-Admin-Password")

		if provided == "" || provided != password {
			writeAdminError(
				w,
				http.StatusUnauthorized,
				"Hibás admin hitelesítés.",
			)
			return
		}

		next(w, r)
	}
}

// ============================================================
// ADMIN ROUTES
// ============================================================

func (s *Server) registerAdminRoutes(
	mux *http.ServeMux,
) {
	mux.HandleFunc(
		"/api/admin/login",
		s.handleAdminLogin,
	)

	mux.HandleFunc(
		"/api/admin/dashboard",
		s.requireAdmin(
			s.handleAdminDashboard,
		),
	)

	mux.HandleFunc(
		"/api/admin/config",
		s.requireAdmin(
			s.handleAdminConfig,
		),
	)

	mux.HandleFunc(
		"/api/admin/student",
		s.requireAdmin(
			s.handleAdminStudent,
		),
	)

	mux.HandleFunc(
		"/api/admin/users",
		s.requireAdmin(
			s.handleAdminUsers,
		),
	)

	mux.HandleFunc(
		"/api/admin/grades",
		s.requireAdmin(
			s.handleAdminGrades,
		),
	)

	mux.HandleFunc(
		"/api/admin/homework",
		s.requireAdmin(
			s.handleAdminHomework,
		),
	)

	mux.HandleFunc(
		"/api/admin/tests",
		s.requireAdmin(
			s.handleAdminTests,
		),
	)

	mux.HandleFunc(
		"/api/admin/omissions",
		s.requireAdmin(
			s.handleAdminOmissions,
		),
	)

	mux.HandleFunc(
		"/api/admin/lessons",
		s.requireAdmin(
			s.handleAdminLessons,
		),
	)

	mux.HandleFunc(
		"/api/admin/notices",
		s.requireAdmin(
			s.handleAdminNotices,
		),
	)

	mux.HandleFunc(
		"/api/admin/info-board",
		s.requireAdmin(
			s.handleAdminInfoBoard,
		),
	)

	mux.HandleFunc(
		"/api/admin/class-groups",
		s.requireAdmin(
			s.handleAdminClassGroups,
		),
	)

	mux.HandleFunc(
		"/api/admin/dkt-subjects",
		s.requireAdmin(
			s.handleAdminDktSubjects,
		),
	)

	mux.HandleFunc(
		"/api/admin/averages",
		s.requireAdmin(
			s.handleAdminAverages,
		),
	)

	mux.HandleFunc(
		"/api/admin/reset",
		s.requireAdmin(
			s.handleAdminReset,
		),
	)
}

// ============================================================
// HELPERS
// ============================================================

func writeAdminJSON(
	w http.ResponseWriter,
	status int,
	value any,
) {
	w.Header().Set(
		"Content-Type",
		"application/json; charset=utf-8",
	)

	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(value)
}

func writeAdminError(
	w http.ResponseWriter,
	status int,
	message string,
) {
	writeAdminJSON(
		w,
		status,
		map[string]any{
			"ok":      false,
			"message": message,
		},
	)
}

func adminMethod(
	w http.ResponseWriter,
	r *http.Request,
	method string,
) bool {
	if r.Method == method {
		return true
	}

	w.Header().Set(
		"Allow",
		method,
	)

	writeAdminError(
		w,
		http.StatusMethodNotAllowed,
		"Nem támogatott HTTP metódus.",
	)

	return false
}

func decodeAdminJSON(
	r *http.Request,
	dst any,
) error {
	decoder := json.NewDecoder(r.Body)

	decoder.DisallowUnknownFields()

	return decoder.Decode(dst)
}

// ============================================================
// LOGIN
// ============================================================
//
// Ez nem hoz létre sessiont.
//
// A frontend a sikeres ellenőrzés után eltárolhatja a jelszót,
// és minden admin API kérésnél elküldheti X-Admin-Password
// headerként.
//
// ============================================================

func (s *Server) handleAdminLogin(
	w http.ResponseWriter,
	r *http.Request,
) {
	if !adminMethod(
		w,
		r,
		http.MethodPost,
	) {
		return
	}

	var request struct {
		Password string `json:"password"`
	}

	if err := decodeAdminJSON(
		r,
		&request,
	); err != nil {
		writeAdminError(
			w,
			http.StatusBadRequest,
			"Hibás JSON.",
		)
		return
	}

	expected := os.Getenv("ADMIN_PASSWORD")

	if expected == "" {
		writeAdminError(
			w,
			http.StatusServiceUnavailable,
			"Az admin felület nincs konfigurálva.",
		)
		return
	}

	if request.Password == "" ||
		request.Password != expected {
		writeAdminError(
			w,
			http.StatusUnauthorized,
			"Hibás admin jelszó.",
		)
		return
	}

	writeAdminJSON(
		w,
		http.StatusOK,
		map[string]any{
			"ok": true,
		},
	)
}

// ============================================================
// DASHBOARD
// ============================================================

func (s *Server) handleAdminDashboard(
	w http.ResponseWriter,
	r *http.Request,
) {
	if !adminMethod(
		w,
		r,
		http.MethodGet,
	) {
		return
	}

	data := map[string]any{
		"ok": true,

		"student": s.store.GetStudent(),

		"config": s.store.GetConfig(),

		"counts": map[string]int{
			"users":         s.countUsers(),
			"grades":        len(s.store.GetGrades()),
			"homework":      len(s.store.GetHomework()),
			"tests":         len(s.store.GetTests()),
			"omissions":     len(s.store.GetOmissions()),
			"lessons":       len(s.store.GetLessons()),
			"notices":       len(s.store.GetNotices()),
			"infoBoard":     len(s.store.GetInfoBoard()),
			"classGroups":   len(s.store.GetClassGroups()),
			"dktSubjects":   len(s.store.GetDktSubjects()),
			"averages":      len(s.store.GetAverages()),
		},
	}

	writeAdminJSON(
		w,
		http.StatusOK,
		data,
	)
}

// ============================================================
// CONFIG
// ============================================================

func (s *Server) handleAdminConfig(
	w http.ResponseWriter,
	r *http.Request,
) {
	switch r.Method {

	case http.MethodGet:

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":     true,
				"config": s.store.GetConfig(),
			},
		)

	case http.MethodPut:

		var value ServerConfig

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetConfig(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":     true,
				"config": s.store.GetConfig(),
			},
		)

	default:

		adminMethod(
			w,
			r,
			http.MethodGet,
		)
	}
}

// ============================================================
// STUDENT
// ============================================================

func (s *Server) handleAdminStudent(
	w http.ResponseWriter,
	r *http.Request,
) {
	switch r.Method {

	case http.MethodGet:

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":      true,
				"student": s.store.GetStudent(),
			},
		)

	case http.MethodPut:

		var value Student

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetStudent(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":      true,
				"student": s.store.GetStudent(),
			},
		)

	default:

		adminMethod(
			w,
			r,
			http.MethodGet,
		)
	}
}

// ============================================================
// USERS
// ============================================================

func (s *Server) countUsers() int {
	ctx := context.Background()

	var count int

	err := s.store.db.QueryRow(
		ctx,
		`SELECT COUNT(*) FROM users`,
	).Scan(&count)

	if err != nil {
		return 0
	}

	return count
}

func (s *Server) handleAdminUsers(
	w http.ResponseWriter,
	r *http.Request,
) {
	switch r.Method {

	case http.MethodGet:

		rows, err := s.store.db.Query(
			r.Context(),
			`
			SELECT
				id::text,
				username,
				student_uid,
				active,
				created_at
			FROM users
			ORDER BY created_at DESC
			`,
		)

		if err != nil {
			writeAdminError(
				w,
				http.StatusInternalServerError,
				"Felhasználók lekérése sikertelen.",
			)
			return
		}

		defer rows.Close()

		users := make([]User, 0)

		for rows.Next() {

			var user User

			if err := rows.Scan(
				&user.ID,
				&user.Username,
				&user.StudentUID,
				&user.Active,
				&user.CreatedAt,
			); err != nil {
				writeAdminError(
					w,
					http.StatusInternalServerError,
					"Felhasználók feldolgozása sikertelen.",
				)
				return
			}

			users = append(
				users,
				user,
			)
		}

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":    true,
				"users": users,
			},
		)

	case http.MethodPost:

		var request struct {
			Username   string `json:"username"`
			Password   string `json:"password"`
			StudentUID string `json:"studentUid"`
		}

		if err := decodeAdminJSON(
			r,
			&request,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		user, err := s.store.CreateUser(
			strings.TrimSpace(request.Username),
			request.Password,
			request.StudentUID,
		)

		if err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				err.Error(),
			)
			return
		}

		writeAdminJSON(
			w,
			http.StatusCreated,
			map[string]any{
				"ok":   true,
				"user": user,
			},
		)

	default:

		adminMethod(
			w,
			r,
			http.MethodGet,
		)
	}
}

// ============================================================
// GRADES
// ============================================================

func (s *Server) handleAdminGrades(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":     true,
				"grades": s.store.GetGrades(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []Grade

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetGrades(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":     true,
				"grades": s.store.GetGrades(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// HOMEWORK
// ============================================================

func (s *Server) handleAdminHomework(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":       true,
				"homework": s.store.GetHomework(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []Homework

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetHomework(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":       true,
				"homework": s.store.GetHomework(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// TESTS
// ============================================================

func (s *Server) handleAdminTests(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":    true,
				"tests": s.store.GetTests(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []Test

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetTests(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":    true,
				"tests": s.store.GetTests(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// OMISSIONS
// ============================================================

func (s *Server) handleAdminOmissions(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":        true,
				"omissions": s.store.GetOmissions(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []Omission

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetOmissions(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":        true,
				"omissions": s.store.GetOmissions(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// LESSONS
// ============================================================

func (s *Server) handleAdminLessons(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":      true,
				"lessons": s.store.GetLessons(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []Lesson

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetLessons(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":      true,
				"lessons": s.store.GetLessons(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// NOTICES
// ============================================================

func (s *Server) handleAdminNotices(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":      true,
				"notices": s.store.GetNotices(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []NoticeBoardItem

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetNotices(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":      true,
				"notices": s.store.GetNotices(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// INFO BOARD
// ============================================================

func (s *Server) handleAdminInfoBoard(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":        true,
				"infoBoard": s.store.GetInfoBoard(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []InfoBoardItem

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetInfoBoard(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":        true,
				"infoBoard": s.store.GetInfoBoard(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// CLASS GROUPS
// ============================================================

func (s *Server) handleAdminClassGroups(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":          true,
				"classGroups": s.store.GetClassGroups(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []ClassGroup

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetClassGroups(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":          true,
				"classGroups": s.store.GetClassGroups(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// DKT
// ============================================================

func (s *Server) handleAdminDktSubjects(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":          true,
				"dktSubjects": s.store.GetDktSubjects(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []DktSubject

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetDktSubjects(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":          true,
				"dktSubjects": s.store.GetDktSubjects(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// AVERAGES
// ============================================================

func (s *Server) handleAdminAverages(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method == http.MethodGet {

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":       true,
				"averages": s.store.GetAverages(),
			},
		)

		return
	}

	if r.Method == http.MethodPut {

		var value []ClassGroupSubjectAverage

		if err := decodeAdminJSON(
			r,
			&value,
		); err != nil {
			writeAdminError(
				w,
				http.StatusBadRequest,
				"Hibás JSON.",
			)
			return
		}

		s.store.SetAverages(value)

		writeAdminJSON(
			w,
			http.StatusOK,
			map[string]any{
				"ok":       true,
				"averages": s.store.GetAverages(),
			},
		)

		return
	}

	adminMethod(
		w,
		r,
		http.MethodGet,
	)
}

// ============================================================
// RESET
// ============================================================

func (s *Server) handleAdminReset(
	w http.ResponseWriter,
	r *http.Request,
) {
	if !adminMethod(
		w,
		r,
		http.MethodPost,
	) {
		return
	}

	s.store.Reset()

	writeAdminJSON(
		w,
		http.StatusOK,
		map[string]any{
			"ok":      true,
			"message": "A mock adatok visszaállítva.",
		},
	)
}

// ============================================================
// CONTEXT HELPER
// ============================================================
//
// A dashboard countUsers() számára.
//
// ============================================================


```
