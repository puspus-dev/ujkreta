package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
)

// ============================================================
// AUTH BŐVÍTÉSEK – role + session a contextben
//
// Ezek a függvények a meglévő auth.go logikáját egészítik ki /
// cserélik. Illeszd be / cseréld a megfelelő részeket.
// ============================================================

// sessionInfo bővített mezőkkel (auth.go-ban is frissítsd a structot):
//
//	type sessionInfo struct {
//		InstituteCode string `json:"instituteCode"`
//		UserID        string `json:"userId"`   // diák vagy tanár UID
//		Username      string `json:"username"`
//		Role          string `json:"role"`     // Tanulo | Tanar
//	}

// buildIdTokenWithRole – role a JWT payloadban
func buildIdTokenWithRole(
	instituteCode string,
	userID string,
	username string,
	displayName string,
	role string,
) string {
	if role == "" {
		role = RoleStudent
	}

	header := map[string]string{
		"alg": "none",
		"typ": "JWT",
	}

	payload := map[string]any{
		"kreta:institute_code":    instituteCode,
		"kreta:institute_user_id": userID,
		"kreta:user_name":         username,
		"name":                    displayName,
		"role":                    role,
		"iat":                     time.Now().Unix(),
	}

	return base64URL(header) + "." + base64URL(payload) + "." + "sig"
}

// requireAuthSession – Bearer token + session a request contextbe
func (s *Server) requireAuthSession(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authz := r.Header.Get("Authorization")
		const prefix = "Bearer "

		if len(authz) <= len(prefix) || !strings.HasPrefix(authz, prefix) {
			writeOAuthError(w, http.StatusUnauthorized, "invalid_token",
				"Hiányzó vagy hibás Authorization header.")
			return
		}

		token := strings.TrimSpace(authz[len(prefix):])
		if token == "" {
			writeOAuthError(w, http.StatusUnauthorized, "invalid_token",
				"Hiányzó access token.")
			return
		}

		info, ok := s.auth.getSession(token)
		if !ok {
			writeOAuthError(w, http.StatusUnauthorized, "invalid_token",
				"Érvénytelen vagy lejárt access token.")
			return
		}

		ctx := contextWithSession(r.Context(), info)
		next(w, r.WithContext(ctx))
	}
}

// getSession – access token → sessionInfo (AuthStore metódus, tedd auth.go-ba)
func (a *AuthStore) getSession(token string) (sessionInfo, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()

	info, ok := a.accessTokens[token]
	return info, ok
}

// handleTokenMultiUser – password grant role-lal és helyes display name-mel.
// A meglévő handleToken password ágát ezzel cseréld / egészítsd ki.
func (s *Server) issueTokenForUser(w http.ResponseWriter, info sessionInfo, displayName string) {
	cfg := s.store.GetConfig()

	accessToken, refreshToken := s.auth.issueTokens(info)
	if accessToken == "" || refreshToken == "" {
		writeOAuthError(w, http.StatusInternalServerError, "server_error",
			"Nem sikerült tokeneket létrehozni.")
		return
	}

	idToken := buildIdTokenWithRole(
		info.InstituteCode,
		info.UserID,
		info.Username,
		displayName,
		info.Role,
	)

	expiresIn := cfg.AccessTokenTTLSeconds
	if expiresIn <= 0 {
		expiresIn = 3600
	}

	resp := map[string]any{
		"id_token":      idToken,
		"access_token":  accessToken,
		"expires_in":    expiresIn,
		"token_type":    "Bearer",
		"refresh_token": refreshToken,
		"scope":         "openid email offline_access kreta-ellenorzo-webapi.public",
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("token response írási hiba: %v", err)
	}
}

// passwordGrantSession – username/password → sessionInfo + displayName
func (s *Server) passwordGrantSession(username, password string) (sessionInfo, string, error) {
	cfg := s.store.GetConfig()

	user, err := s.store.GetUserByUsername(username)
	if err != nil {
		return sessionInfo{}, "", err
	}

	if !s.store.CheckPassword(user, password) {
		return sessionInfo{}, "", errInvalidCredentials
	}

	role := user.Role
	if role == "" {
		role = RoleStudent
	}

	info := sessionInfo{
		InstituteCode: cfg.InstituteCode,
		UserID:        user.StudentUID,
		Username:      user.Username,
		Role:          role,
	}

	displayName := user.Username

	switch role {
	case RoleTeacher:
		// Tanár neve – ha van teacher store
		displayName = "Tanár"
		if t, err := s.store.GetStudentByUID(user.StudentUID); err == nil && t.Nev != "" {
			// ha véletlenül student táblában van
			displayName = t.Nev
		}
	case RoleStudent:
		if st, err := s.store.GetStudentByUID(user.StudentUID); err == nil {
			displayName = st.Nev
		} else {
			st := s.store.GetStudent()
			if st.Uid == user.StudentUID {
				displayName = st.Nev
			}
		}
	}

	return info, displayName, nil
}

var errInvalidCredentials = errInvalidCreds{}

type errInvalidCreds struct{}

func (errInvalidCreds) Error() string { return "invalid credentials" }
