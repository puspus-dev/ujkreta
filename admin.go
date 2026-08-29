package main

import (
"crypto/rand"
"encoding/hex"
"encoding/json"
"net/http"
"strings"
"sync"
)

type adminSessionStore struct {
mu     sync.RWMutex
tokens map[string]bool
}

var adminSessions = adminSessionStore{
tokens: make(map[string]bool),
}

func adminJSON(w http.ResponseWriter, status int, value any) {
w.Header().Set("Content-Type", "application/json; charset=utf-8")
w.WriteHeader(status)


_ = json.NewEncoder(w).Encode(value)


}

func adminError(w http.ResponseWriter, status int, message string) {
adminJSON(w, status, map[string]any{
"success": false,
"error":   message,
})
}

func randomToken() string {
buf := make([]byte, 32)

```
if _, err := rand.Read(buf); err != nil {
	return ""
}

return hex.EncodeToString(buf)
```

}

func registerAdminToken(token string) {
if token == "" {
return
}

```
adminSessions.mu.Lock()
defer adminSessions.mu.Unlock()

adminSessions.tokens[token] = true
```

}

func isValidAdminToken(token string) bool {
if token == "" {
return false
}

```
adminSessions.mu.RLock()
defer adminSessions.mu.RUnlock()

return adminSessions.tokens[token]
```

}

func (s *Server) requireAdmin(w http.ResponseWriter, r *http.Request) bool {
auth := r.Header.Get("Authorization")

```
if auth == "" {
	adminError(
		w,
		http.StatusUnauthorized,
		"Hiányzó Authorization fejléc.",
	)
	return false
}

if !strings.HasPrefix(auth, "Bearer ") {
	adminError(
		w,
		http.StatusUnauthorized,
		"Hibás Authorization fejléc.",
	)
	return false
}

token := strings.TrimSpace(
	strings.TrimPrefix(auth, "Bearer "),
)

if !isValidAdminToken(token) {
	adminError(
		w,
		http.StatusUnauthorized,
		"Érvénytelen admin token.",
	)
	return false
}

return true
```

}

func (s *Server) adminLogin(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodPost {
adminError(
w,
http.StatusMethodNotAllowed,
"Nem támogatott HTTP metódus.",
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

if token == "" {
	adminError(
		w,
		http.StatusInternalServerError,
		"Nem sikerült biztonságos tokent létrehozni.",
	)
	return
}

registerAdminToken(token)

adminJSON(w, http.StatusOK, map[string]any{
	"success": true,
	"token":   token,
})
```

}

func (s *Server) adminHealth(w http.ResponseWriter, r *http.Request) {
if r.Method != http.MethodGet {
adminError(
w,
http.StatusMethodNotAllowed,
"Nem támogatott HTTP metódus.",
)
return
}

```
adminJSON(w, http.StatusOK, map[string]any{
	"success": true,
	"status":  "ok",
})
```

}

func (s *Server) adminDashboard(w http.ResponseWriter, r *http.Request) {
if !s.requireAdmin(w, r) {
return
}

```
if r.Method != http.MethodGet {
	adminError(
		w,
		http.StatusMethodNotAllowed,
		"Nem támogatott HTTP metódus.",
	)
	return
}

adminJSON(w, http.StatusOK, map[string]any{
	"success": true,

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

func (s *Server) adminReset(w http.ResponseWriter, r *http.Request) {
if !s.requireAdmin(w, r) {
return
}

```
if r.Method != http.MethodPost {
	adminError(
		w,
		http.StatusMethodNotAllowed,
		"Nem támogatott HTTP metódus.",
	)
	return
}

s.store.Reset()

adminJSON(w, http.StatusOK, map[string]any{
	"success": true,
	"message": "Az adatok vissza lettek állítva a seed adatokra.",
})
```

}

func (s *Server) adminConfig(w http.ResponseWriter, r *http.Request) {
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

func (s *Server) adminStudent(w http.ResponseWriter, r *http.Request) {
if !s.requireAdmin(w, r) {
return
}


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

