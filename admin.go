package main

import (
"encoding/json"
"net/http"
"strings"
)

func (s *Server) registerAdminRoutes(mux *http.ServeMux) {
mux.HandleFunc("/admin/api/login", s.handleAdminLogin)
mux.HandleFunc("/admin/api/overview", s.handleAdminOverview)
mux.HandleFunc("/admin/api/reset", s.handleAdminReset)
mux.HandleFunc("/admin/api/config", s.handleAdminConfig)
mux.HandleFunc("/admin/api/student", s.handleAdminStudent)
mux.HandleFunc("/admin/api/grades", s.handleAdminGrades)
mux.HandleFunc("/admin/api/homework", s.handleAdminHomework)
mux.HandleFunc("/admin/api/tests", s.handleAdminTests)
mux.HandleFunc("/admin/api/omissions", s.handleAdminOmissions)
mux.HandleFunc("/admin/api/lessons", s.handleAdminLessons)
mux.HandleFunc("/admin/api/notices", s.handleAdminNotices)
mux.HandleFunc("/admin/api/info-board", s.handleAdminInfoBoard)
mux.HandleFunc("/admin/api/class-groups", s.handleAdminClassGroups)
mux.HandleFunc("/admin/api/dkt-subjects", s.handleAdminDktSubjects)
mux.HandleFunc("/admin/api/averages", s.handleAdminAverages)
}

func adminJSON(w http.ResponseWriter, status int, value any) {
w.Header().Set("Content-Type", "application/json; charset=utf-8")
w.WriteHeader(status)

```
_ = json.NewEncoder(w).Encode(value)
```

}

func adminError(w http.ResponseWriter, status int, message string) {
adminJSON(w, status, map[string]any{
"error": message,
})
}

func adminTokenValid(r *http.Request) bool {
auth := r.Header.Get("Authorization")

```
if auth == "" {
	return false
}

return strings.HasPrefix(auth, "Bearer ")
```

}

func (s *Server) requireAdmin(
w http.ResponseWriter,
r *http.Request,
) bool {
if !adminTokenValid(r) {
adminError(
w,
http.StatusUnauthorized,
"Hiányzó admin token.",
)

```
	return false
}

return true
```

}

// ============================================================
// ADMIN LOGIN
// ============================================================

func (s *Server) handleAdminLogin(
w http.ResponseWriter,
r *http.Request,
) {
if r.Method != http.MethodPost {
adminError(
w,
http.StatusMethodNotAllowed,
"Csak POST kérés engedélyezett.",
)
return
}

```
if err := r.ParseForm(); err != nil {
	adminError(
		w,
		http.StatusBadRequest,
		"Hibás kérés.",
	)
	return
}

username := r.FormValue("username")
password := r.FormValue("password")

cfg := s.store.GetConfig()

if username != cfg.Username || password != cfg.Password {
	adminError(
		w,
		http.StatusUnauthorized,
		"Hibás admin felhasználónév vagy jelszó.",
	)
	return
}

token := randomToken()

adminJSON(w, http.StatusOK, map[string]any{
	"success": true,
	"token":   token,
})
```

}

// ============================================================
// OVERVIEW
// ============================================================

func (s *Server) handleAdminOverview(
w http.ResponseWriter,
r *http.Request,
) {
if r.Method != http.MethodGet {
adminError(
w,
http.StatusMethodNotAllowed,
"Csak GET kérés engedélyezett.",
)
return
}

```
if !s.requireAdmin(w, r) {
	return
}

adminJSON(w, http.StatusOK, map[string]any{
	"config": s.store.GetConfig(),

	"counts": map[string]int{
		"classGroups": len(s.store.GetClassGroups()),
		"grades":      len(s.store.GetGrades()),
		"homework":    len(s.store.GetHomework()),
		"tests":       len(s.store.GetTests()),
		"omissions":   len(s.store.GetOmissions()),
		"lessons":     len(s.store.GetLessons()),
		"notices":     len(s.store.GetNotices()),
		"infoBoard":   len(s.store.GetInfoBoard()),
		"dktSubjects": len(s.store.GetDktSubjects()),
		"averages":    len(s.store.GetAverages()),
	},
})
```

}

// ============================================================
// RESET
// ============================================================

func (s *Server) handleAdminReset(
w http.ResponseWriter,
r *http.Request,
) {
if r.Method != http.MethodPost {
adminError(
w,
http.StatusMethodNotAllowed,
"Csak POST kérés engedélyezett.",
)
return
}

```
if !s.requireAdmin(w, r) {
	return
}

s.store.Reset()

adminJSON(w, http.StatusOK, map[string]any{
	"success": true,
	"message": "Az adatok vissza lettek állítva a seed adatokra.",
})
```

}

// ============================================================
// CONFIG
// ============================================================

func (s *Server) handleAdminConfig(
w http.ResponseWriter,
r *http.Request,
) {
if !s.requireAdmin(w, r) {
return
}

```
switch r.Method {
case http.MethodGet:
	adminJSON(
		w,
		http.StatusOK,
		s.store.GetConfig(),
	)

case http.MethodPut, http.MethodPost:
	var value ServerConfig

	if err := json.NewDecoder(r.Body).Decode(&value); err != nil {
		adminError(
			w,
			http.StatusBadRequest,
			"Hibás JSON.",
		)
		return
	}

	s.store.SetConfig(value)

	adminJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"config":  value,
	})

default:
	adminError(
		w,
		http.StatusMethodNotAllowed,
		"Nem támogatott HTTP metódus.",
	)
}
```

}

// ============================================================
// STUDENT
// ============================================================

func (s *Server) handleAdminStudent(
w http.ResponseWriter,
r *http.Request,
) {
if !s.requireAdmin(w, r) {
return
}

```
switch r.Method {
case http.MethodGet:
	adminJSON(
		w,
		http.StatusOK,
		s.store.GetStudent(),
	)

case http.MethodPut, http.MethodPost:
	var value Student

	if err := json.NewDecoder(r.Body).Decode(&value); err != nil {
		adminError(
			w,
			http.StatusBadRequest,
			"Hibás JSON.",
		)
		return
	}

	s.store.SetStudent(value)

	adminJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"student": value,
	})

default:
	adminError(
		w,
		http.StatusMethodNotAllowed,
		"Nem támogatott HTTP metódus.",
	)
}
```

}

// ============================================================
// GENERIC JSON HELPERS
// ============================================================

func decodeAdminJSON[T any](
r *http.Request,
) (T, error) {
var value T

```
err := json.NewDecoder(r.Body).Decode(&value)

return value, err
```

}

func adminCollection[T any](
w http.ResponseWriter,
r *http.Request,
get func() []T,
set func([]T),
) {
if !strings.HasPrefix(
r.Header.Get("Authorization"),
"Bearer ",
) {
adminError(
w,
http.StatusUnauthorized,
"Hiányzó admin token.",
)
return
}

```
switch r.Method {
case http.MethodGet:
	adminJSON(
		w,
		http.StatusOK,
		get(),
	)

case http.MethodPut, http.MethodPost:
	value, err := decodeAdminJSON[[]T](r)

	if err != nil {
		adminError(
			w,
			http.StatusBadRequest,
			"Hibás JSON.",
		)
		return
	}

	set(value)

	adminJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    value,
	})

default:
	adminError(
		w,
		http.StatusMethodNotAllowed,
		"Nem támogatott HTTP metódus.",
	)
}
```

}

// ============================================================
// CLASS GROUPS
// ============================================================

func (s *Server) handleAdminClassGroups(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetClassGroups,
s.store.SetClassGroups,
)
}

// ============================================================
// GRADES
// ============================================================

func (s *Server) handleAdminGrades(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetGrades,
s.store.SetGrades,
)
}

// ============================================================
// HOMEWORK
// ============================================================

func (s *Server) handleAdminHomework(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetHomework,
s.store.SetHomework,
)
}

// ============================================================
// TESTS
// ============================================================

func (s *Server) handleAdminTests(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetTests,
s.store.SetTests,
)
}

// ============================================================
// OMISSIONS
// ============================================================

func (s *Server) handleAdminOmissions(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetOmissions,
s.store.SetOmissions,
)
}

// ============================================================
// LESSONS
// ============================================================

func (s *Server) handleAdminLessons(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetLessons,
s.store.SetLessons,
)
}

// ============================================================
// NOTICES
// ============================================================

func (s *Server) handleAdminNotices(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetNotices,
s.store.SetNotices,
)
}

// ============================================================
// INFO BOARD
// ============================================================

func (s *Server) handleAdminInfoBoard(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetInfoBoard,
s.store.SetInfoBoard,
)
}

// ============================================================
// DKT
// ============================================================

func (s *Server) handleAdminDktSubjects(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetDktSubjects,
s.store.SetDktSubjects,
)
}

// ============================================================
// AVERAGES
// ============================================================

func (s *Server) handleAdminAverages(
w http.ResponseWriter,
r *http.Request,
) {
adminCollection(
w,
r,
s.store.GetAverages,
s.store.SetAverages,
)
}
