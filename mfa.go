package main

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base32"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
)

// ============================================================
// Opcionális 2FA (TOTP) – csak Tanar / Osztalyfonok
//
// main.go:  server.registerMFARoutes(mux)
// auth.go password grant: lásd MFA_AUTH_PATCH.md
// ============================================================

const (
	mfaPendingTTL     = 5 * time.Minute
	mfaTrustedDays    = 30
	mfaIssuerName     = "KRATA"
)

type mfaPending struct {
	Username  string
	UserID    string
	Role      string
	Institute string
	Expires   time.Time
}

type mfaStore struct {
	mu       sync.Mutex
	pending  map[string]mfaPending // mfa_token → session draft
	trusted  map[string]time.Time  // trustKey → expiry (memory fallback)
}

var globalMFA = &mfaStore{
	pending: make(map[string]mfaPending),
	trusted: make(map[string]time.Time),
}

func (m *mfaStore) putPending(tok string, p mfaPending) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pending[tok] = p
}

func (m *mfaStore) takePending(tok string) (mfaPending, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.pending[tok]
	if !ok {
		return mfaPending{}, false
	}
	if time.Now().After(p.Expires) {
		delete(m.pending, tok)
		return mfaPending{}, false
	}
	delete(m.pending, tok)
	return p, true
}

func (m *mfaStore) peekPending(tok string) (mfaPending, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.pending[tok]
	if !ok || time.Now().After(p.Expires) {
		return mfaPending{}, false
	}
	return p, true
}

func roleNeedsMFAOption(role string) bool {
	r := strings.TrimSpace(role)
	return r == RoleTeacher || r == "Tanar" || r == "Osztalyfonok"
}

// ---- TOTP (RFC 6238, SHA1, 30s, 6 digits) ----

func randomBase32Secret(bytes int) (string, error) {
	b := make([]byte, bytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b), nil
}

func hotp(secret []byte, counter uint64) int {
	var buf [8]byte
	binary.BigEndian.PutUint64(buf[:], counter)
	mac := hmac.New(sha1.New, secret)
	_, _ = mac.Write(buf[:])
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	code := (int(sum[offset])&0x7f)<<24 |
		(int(sum[offset+1])&0xff)<<16 |
		(int(sum[offset+2])&0xff)<<8 |
		(int(sum[offset+3]) & 0xff)
	return code % 1000000
}

func verifyTOTP(base32Secret, code string, skew int) bool {
	code = strings.TrimSpace(code)
	if len(code) != 6 {
		return false
	}
	sec, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(strings.ReplaceAll(base32Secret, " ", "")))
	if err != nil || len(sec) == 0 {
		return false
	}
	now := time.Now().Unix() / 30
	for d := -skew; d <= skew; d++ {
		c := hotp(sec, uint64(int64(now)+int64(d)))
		if fmt.Sprintf("%06d", c) == code {
			return true
		}
	}
	return false
}

func currentTOTP(base32Secret string) string {
	sec, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(strings.ReplaceAll(base32Secret, " ", "")))
	if err != nil {
		return ""
	}
	c := hotp(sec, uint64(time.Now().Unix()/30))
	return fmt.Sprintf("%06d", c)
}

// ---- DB ----

func (s *Store) ensureMFASchema() {
	ctx := context.Background()
	_, err := s.db.Exec(ctx, `
		ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT NOT NULL DEFAULT '';
		ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
		ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_recovery TEXT NOT NULL DEFAULT '';
	`)
	if err != nil {
		log.Printf("ensureMFASchema: %v", err)
	}
}

func (s *Store) GetUserMFA(username string) (secret string, enabled bool, err error) {
	ctx := context.Background()
	err = s.db.QueryRow(ctx,
		`SELECT COALESCE(totp_secret,''), COALESCE(totp_enabled,FALSE) FROM users WHERE username = $1`,
		username,
	).Scan(&secret, &enabled)
	return
}

func (s *Store) SetUserMFA(username, secret string, enabled bool) error {
	ctx := context.Background()
	_, err := s.db.Exec(ctx,
		`UPDATE users SET totp_secret = $2, totp_enabled = $3 WHERE username = $1`,
		username, secret, enabled,
	)
	return err
}

func (s *Store) SetUserMFARecovery(username, recoveryHash string) error {
	ctx := context.Background()
	_, err := s.db.Exec(ctx,
		`UPDATE users SET totp_recovery = $2 WHERE username = $1`,
		username, recoveryHash,
	)
	return err
}

func (s *Store) GetUserMFARecovery(username string) (string, error) {
	ctx := context.Background()
	var h string
	err := s.db.QueryRow(ctx, `SELECT COALESCE(totp_recovery,'') FROM users WHERE username = $1`, username).Scan(&h)
	return h, err
}

func hashRecovery(code string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(strings.ToUpper(code))))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func randomRecoveryCode() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return strings.ToUpper(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b)[:8])
}

func trustKey(username, deviceToken string) string {
	sum := sha256.Sum256([]byte(username + "|" + deviceToken))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func (m *mfaStore) isTrusted(username, deviceToken string) bool {
	if deviceToken == "" {
		return false
	}
	k := trustKey(username, deviceToken)
	m.mu.Lock()
	defer m.mu.Unlock()
	exp, ok := m.trusted[k]
	if !ok || time.Now().After(exp) {
		delete(m.trusted, k)
		return false
	}
	return true
}

func (m *mfaStore) markTrusted(username, deviceToken string) {
	if deviceToken == "" {
		return
	}
	k := trustKey(username, deviceToken)
	m.mu.Lock()
	defer m.mu.Unlock()
	m.trusted[k] = time.Now().Add(mfaTrustedDays * 24 * time.Hour)
}

func randomTokenB64(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// AfterPasswordCheckMFA – hívd a sikeres jelszóellenőrzés után.
// Ha MFA kell: true + mfa_token (ne adj access_token-t).
// Ha nem kell: false.
func (s *Server) AfterPasswordCheckMFA(user User, instituteCode, deviceToken string) (needMFA bool, mfaToken string) {
	if !roleNeedsMFAOption(user.Role) {
		return false, ""
	}
	secret, enabled, err := s.store.GetUserMFA(user.Username)
	if err != nil || !enabled || secret == "" {
		return false, ""
	}
	if globalMFA.isTrusted(user.Username, deviceToken) {
		return false, ""
	}
	tok := randomTokenB64(24)
	globalMFA.putPending(tok, mfaPending{
		Username:  user.Username,
		UserID:    user.StudentUID,
		Role:      user.Role,
		Institute: instituteCode,
		Expires:   time.Now().Add(mfaPendingTTL),
	})
	return true, tok
}

func (s *Server) registerMFARoutes(mux *http.ServeMux) {
	s.store.ensureMFASchema()

	// grant_type=mfa  a /connect/token-en keresztül is mehet (auth patch),
	// plusz dedikált végpontok:
	mux.HandleFunc("/connect/mfa/verify", s.handleMFAVerify)
	mux.HandleFunc("/ellenorzo/v3/sajat/Mfa/Status", s.requireAuthSession(s.handleMFAStatus))
	mux.HandleFunc("/ellenorzo/v3/sajat/Mfa/Setup", s.requireAuthSession(s.handleMFASetup))
	mux.HandleFunc("/ellenorzo/v3/sajat/Mfa/Enable", s.requireAuthSession(s.handleMFAEnable))
	mux.HandleFunc("/ellenorzo/v3/sajat/Mfa/Disable", s.requireAuthSession(s.handleMFADisable))
}

func (s *Server) handleMFAVerify(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}
	_ = r.ParseForm()
	mfaToken := strings.TrimSpace(firstNonEmpty(r.FormValue("mfa_token"), r.FormValue("mfaToken")))
	code := strings.TrimSpace(firstNonEmpty(r.FormValue("code"), r.FormValue("otp"), r.FormValue("totp")))
	trust := r.FormValue("trust_device") == "1" || r.FormValue("trust_device") == "true" || r.FormValue("trustDevice") == "true"
	deviceTok := strings.TrimSpace(r.FormValue("device_token"))

	// JSON body is
	if mfaToken == "" || code == "" {
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			if mfaToken == "" {
				mfaToken, _ = body["mfa_token"].(string)
				if mfaToken == "" {
					mfaToken, _ = body["mfaToken"].(string)
				}
			}
			if code == "" {
				code, _ = body["code"].(string)
				if code == "" {
					code, _ = body["otp"].(string)
				}
			}
			if v, ok := body["trust_device"].(bool); ok && v {
				trust = true
			}
			if dt, ok := body["device_token"].(string); ok {
				deviceTok = dt
			}
		}
	}

	pending, ok := globalMFA.peekPending(mfaToken)
	if !ok {
		writeOAuthError(w, http.StatusUnauthorized, "invalid_grant", "Érvénytelen vagy lejárt MFA munkamenet. Jelentkezz be újra.")
		return
	}

	secret, enabled, err := s.store.GetUserMFA(pending.Username)
	if err != nil || !enabled {
		writeOAuthError(w, http.StatusUnauthorized, "invalid_grant", "A kétfaktoros azonosítás nincs bekapcsolva.")
		return
	}

	okCode := verifyTOTP(secret, code, 1)
	if !okCode {
		// recovery code?
		rec, _ := s.store.GetUserMFARecovery(pending.Username)
		if rec != "" && rec == hashRecovery(code) {
			okCode = true
			// egyféle recovery: töröljük használat után
			_ = s.store.SetUserMFARecovery(pending.Username, "")
		}
	}
	if !okCode {
		writeOAuthError(w, http.StatusUnauthorized, "invalid_grant", "Hibás hitelesítő kód.")
		return
	}

	pending, ok = globalMFA.takePending(mfaToken)
	if !ok {
		writeOAuthError(w, http.StatusUnauthorized, "invalid_grant", "Érvénytelen MFA munkamenet.")
		return
	}

	if trust {
		if deviceTok == "" {
			deviceTok = randomTokenB64(16)
		}
		globalMFA.markTrusted(pending.Username, deviceTok)
	}

	s.issueTokensForSession(w, sessionInfo{
		InstituteCode: pending.Institute,
		UserID:        pending.UserID,
		Username:      pending.Username,
		Role:          pending.Role,
	}, deviceTok, trust)
}

func (s *Server) issueTokensForSession(w http.ResponseWriter, info sessionInfo, deviceTok string, trust bool) {
	cfg := s.store.GetConfig()
	accessToken, refreshToken := s.auth.issueTokens(info)
	if accessToken == "" {
		writeOAuthError(w, http.StatusInternalServerError, "server_error", "Nem sikerült tokeneket létrehozni.")
		return
	}
	displayName := info.Username
	idToken := buildIdToken(info.InstituteCode, info.UserID, info.Username, displayName, info.Role)
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
	if trust && deviceTok != "" {
		resp["device_token"] = deviceTok
		resp["device_token_expires_days"] = mfaTrustedDays
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleMFAStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}
	sess, ok := sessionFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !roleNeedsMFAOption(sess.Role) {
		writeJSON(w, http.StatusOK, map[string]any{"available": false, "enabled": false})
		return
	}
	_, enabled, _ := s.store.GetUserMFA(sess.Username)
	writeJSON(w, http.StatusOK, map[string]any{
		"available": true,
		"enabled":   enabled,
		"role":      sess.Role,
	})
}

func (s *Server) handleMFASetup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodGet {
		methodNotAllowed(w, "GET, POST")
		return
	}
	sess, ok := sessionFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !roleNeedsMFAOption(sess.Role) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "mfa_only_teacher_of"})
		return
	}
	secret, err := randomBase32Secret(20)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "secret_failed"})
		return
	}
	// ideiglenes secret enabled=false
	if err := s.store.SetUserMFA(sess.Username, secret, false); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	otpauth := fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&digits=6&period=30",
		mfaIssuerName, sess.Username, secret, mfaIssuerName)
	writeJSON(w, http.StatusOK, map[string]any{
		"secret":  secret,
		"otpauth": otpauth,
		"issuer":  mfaIssuerName,
		"account": sess.Username,
		"hint":    "Olvasd be authenticator appal, majd POST /Mfa/Enable a 6 jegyű kóddal.",
	})
}

func (s *Server) handleMFAEnable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}
	sess, ok := sessionFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !roleNeedsMFAOption(sess.Role) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "mfa_only_teacher_of"})
		return
	}
	var body struct {
		Code string `json:"code"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	secret, _, err := s.store.GetUserMFA(sess.Username)
	if err != nil || secret == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "run_setup_first"})
		return
	}
	if !verifyTOTP(secret, body.Code, 1) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_code", "message": "Hibás kód."})
		return
	}
	if err := s.store.SetUserMFA(sess.Username, secret, true); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	rec := randomRecoveryCode()
	_ = s.store.SetUserMFARecovery(sess.Username, hashRecovery(rec))
	writeJSON(w, http.StatusOK, map[string]any{
		"success":       true,
		"enabled":       true,
		"recovery_code": rec,
		"message":       "2FA bekapcsolva. A helyreállító kódot mentsd el – egyszer használható.",
	})
}

func (s *Server) handleMFADisable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}
	sess, ok := sessionFromRequest(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !roleNeedsMFAOption(sess.Role) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "mfa_only_teacher_of"})
		return
	}
	var body struct {
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)

	user, err := s.store.GetUserByUsername(sess.Username)
	if err != nil || !s.store.CheckPassword(user, body.Password) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "bad_password"})
		return
	}
	secret, enabled, _ := s.store.GetUserMFA(sess.Username)
	if enabled {
		okCode := verifyTOTP(secret, body.Code, 1)
		if !okCode {
			rec, _ := s.store.GetUserMFARecovery(sess.Username)
			if rec == "" || rec != hashRecovery(body.Code) {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_code"})
				return
			}
		}
	}
	_ = s.store.SetUserMFA(sess.Username, "", false)
	_ = s.store.SetUserMFARecovery(sess.Username, "")
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "enabled": false})
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// RoleOsztalyfonok may live in of_role_patch.go – if not linked, local fallback
