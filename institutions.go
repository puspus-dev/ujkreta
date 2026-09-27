package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// Institution – egy iskola / intézmény a rendszerben
type Institution struct {
	Uid      string `json:"Uid"`
	Kod      string `json:"Kod"` // bejelentkezéshez használt kód (pl. dae0004)
	Nev      string `json:"Nev"`
	RovidNev string `json:"RovidNev,omitempty"`
	Varos    string `json:"Varos,omitempty"`
	Active   bool   `json:"Active"`
}

func (s *Store) ensureInstitutionsSchema() {
	ctx := context.Background()
	_, err := s.db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS institutions (
			uid TEXT PRIMARY KEY,
			kod TEXT NOT NULL UNIQUE,
			nev TEXT NOT NULL,
			rovid_nev TEXT NOT NULL DEFAULT '',
			varos TEXT NOT NULL DEFAULT '',
			active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE INDEX IF NOT EXISTS idx_institutions_kod ON institutions (kod);
		CREATE INDEX IF NOT EXISTS idx_institutions_active ON institutions (active);

		ALTER TABLE users ADD COLUMN IF NOT EXISTS institute_code TEXT NOT NULL DEFAULT '';
		CREATE INDEX IF NOT EXISTS idx_users_institute ON users (institute_code);
	`)
	if err != nil {
		log.Printf("ensureInstitutionsSchema: %v", err)
		return
	}

	// Seed, ha üres
	var n int
	_ = s.db.QueryRow(ctx, `SELECT COUNT(*) FROM institutions`).Scan(&n)
	if n == 0 {
		seeds := []Institution{
			{Uid: "dae0004", Kod: "dae0004", Nev: "SuliKód Gimnázium", RovidNev: "SuliKód", Varos: "Kisvárda", Active: true},
			{Uid: "mockschool", Kod: "mockschool", Nev: "Mock Gimnázium", RovidNev: "Mock", Varos: "Budapest", Active: true},
			{Uid: "demo001", Kod: "demo001", Nev: "Demó Általános Iskola", RovidNev: "Demó ÁI", Varos: "Debrecen", Active: true},
		}
		for _, inst := range seeds {
			_ = s.UpsertInstitution(inst)
		}
		log.Println("institutions: seed intézmények létrehozva")
	}
}

func (s *Store) ListInstitutions(onlyActive bool) []Institution {
	ctx := context.Background()
	q := `SELECT uid, kod, nev, rovid_nev, varos, active FROM institutions`
	if onlyActive {
		q += ` WHERE active = TRUE`
	}
	q += ` ORDER BY nev`

	rows, err := s.db.Query(ctx, q)
	if err != nil {
		log.Printf("ListInstitutions: %v", err)
		return nil
	}
	defer rows.Close()

	out := make([]Institution, 0)
	for rows.Next() {
		var inst Institution
		if err := rows.Scan(&inst.Uid, &inst.Kod, &inst.Nev, &inst.RovidNev, &inst.Varos, &inst.Active); err != nil {
			continue
		}
		out = append(out, inst)
	}
	return out
}

func (s *Store) GetInstitutionByKod(kod string) (Institution, error) {
	kod = strings.TrimSpace(kod)
	ctx := context.Background()
	var inst Institution
	err := s.db.QueryRow(ctx,
		`SELECT uid, kod, nev, rovid_nev, varos, active FROM institutions WHERE kod = $1 LIMIT 1`,
		kod,
	).Scan(&inst.Uid, &inst.Kod, &inst.Nev, &inst.RovidNev, &inst.Varos, &inst.Active)
	if err != nil {
		return Institution{}, fmt.Errorf("intézmény nem található: %s", kod)
	}
	return inst, nil
}

func (s *Store) UpsertInstitution(inst Institution) error {
	ctx := context.Background()
	if strings.TrimSpace(inst.Kod) == "" {
		return fmt.Errorf("kod_required")
	}
	if strings.TrimSpace(inst.Nev) == "" {
		return fmt.Errorf("nev_required")
	}
	if inst.Uid == "" {
		inst.Uid = inst.Kod
	}
	if inst.RovidNev == "" {
		inst.RovidNev = inst.Nev
	}
	_, err := s.db.Exec(ctx, `
		INSERT INTO institutions (uid, kod, nev, rovid_nev, varos, active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		ON CONFLICT (uid) DO UPDATE SET
			kod = EXCLUDED.kod,
			nev = EXCLUDED.nev,
			rovid_nev = EXCLUDED.rovid_nev,
			varos = EXCLUDED.varos,
			active = EXCLUDED.active,
			updated_at = NOW()
	`, inst.Uid, inst.Kod, inst.Nev, inst.RovidNev, inst.Varos, inst.Active)
	return err
}

func (s *Store) DeleteInstitution(uid string) error {
	uid = strings.TrimSpace(uid)
	if uid == "" {
		return fmt.Errorf("uid_required")
	}
	ctx := context.Background()
	_, err := s.db.Exec(ctx, `DELETE FROM institutions WHERE uid = $1 OR kod = $1`, uid)
	return err
}

func (s *Store) SetUserInstituteCode(username, instituteCode string) error {
	ctx := context.Background()
	_, err := s.db.Exec(ctx,
		`UPDATE users SET institute_code = $2 WHERE username = $1`,
		username, strings.TrimSpace(instituteCode),
	)
	return err
}

func (s *Store) GetUserInstituteCode(username string) string {
	ctx := context.Background()
	var code *string
	_ = s.db.QueryRow(ctx, `SELECT institute_code FROM users WHERE username = $1`, username).Scan(&code)
	if code == nil {
		return ""
	}
	return *code
}

// ============================================================
// HTTP – publikus lista (főoldal intézményválasztó)
// ============================================================

func (s *Server) registerInstitutionRoutes(mux *http.ServeMux) {
	s.store.ensureInstitutionsSchema()

	// Publikus – nincs auth (login előtti választó)
	mux.HandleFunc("/intezmenyek", s.handlePublicInstitutions)
	mux.HandleFunc("/api/public/institutions", s.handlePublicInstitutions)

	// Admin CRUD
	mux.HandleFunc("/admin/institutions", s.requireAdmin(s.handleAdminInstitutions))
}

func (s *Server) handlePublicInstitutions(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}
	list := s.store.ListInstitutions(true)
	// KRÉTA-szerű egyszerű mezők a frontendre
	out := make([]map[string]any, 0, len(list))
	for _, inst := range list {
		out = append(out, map[string]any{
			"Uid":      inst.Uid,
			"Kod":      inst.Kod,
			"Nev":      inst.Nev,
			"RovidNev": inst.RovidNev,
			"Varos":    inst.Varos,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleAdminInstitutions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.ListInstitutions(false))

	case http.MethodPost, http.MethodPut:
		var inst Institution
		if err := json.NewDecoder(r.Body).Decode(&inst); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
			return
		}
		inst.Active = true
		if err := s.store.UpsertInstitution(inst); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "institution": inst})

	case http.MethodDelete:
		uid := strings.TrimSpace(r.URL.Query().Get("uid"))
		if uid == "" {
			uid = strings.TrimSpace(r.URL.Query().Get("kod"))
		}
		if uid == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "uid_required"})
			return
		}
		if err := s.store.DeleteInstitution(uid); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "deleted": uid})

	default:
		methodNotAllowed(w, "GET, POST, PUT, DELETE")
	}
}

// ResolveInstituteForLogin – form institute_code + user ellenőrzés
func (s *Store) ResolveInstituteForLogin(username, requestedKod string) (string, error) {
	requestedKod = strings.TrimSpace(requestedKod)
	userKod := s.GetUserInstituteCode(username)

	if requestedKod == "" {
		if userKod != "" {
			return userKod, nil
		}
		// fallback config
		cfg := s.GetConfig()
		if cfg.InstituteCode != "" {
			return cfg.InstituteCode, nil
		}
		return "dae0004", nil
	}

	inst, err := s.GetInstitutionByKod(requestedKod)
	if err != nil || !inst.Active {
		return "", fmt.Errorf("ismeretlen vagy inaktív intézmény: %s", requestedKod)
	}

	// Ha a userhez van kötve intézmény, egyeznie kell (üres = bármelyikhez mehet)
	if userKod != "" && !strings.EqualFold(userKod, requestedKod) {
		return "", fmt.Errorf("ez a felhasználó nem ehhez az intézményhez tartozik")
	}

	return requestedKod, nil
}

// noop keep time import used if needed
var _ = time.Now
