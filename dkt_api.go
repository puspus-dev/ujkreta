package main

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	dktMu              sync.Mutex
	dktHomeworkSols    = []map[string]any{}
	dktOraiFeladatok   []map[string]any
	dktTananyagok      []map[string]any
	dktClasswork       []map[string]any
)

func init() {
	now := time.Now().UTC().Format(time.RFC3339)
	dktOraiFeladatok = []map[string]any{
		{
			"id": 1, "cim": "Órai feladat 1", "szoveg": "Oldd meg a táblán lévő példát.",
			"tantargyId": 1, "tantargyNev": "Matematika", "oraDatum": time.Now().Format("2006-01-02"),
			"oraszam": 2, "letrehozasIdeje": now, "alkalmazottNev": "Szaktanár",
		},
	}
	dktTananyagok = []map[string]any{
		{
			"id": 1, "cim": "Év eleji tematika", "szoveg": "A félév anyaga.",
			"tantargyId": 1, "tantargyNev": "Matematika", "letrehozasIdeje": now,
		},
	}
	dktClasswork = []map[string]any{
		{
			"id": 101, "cim": "Minta beadandó", "szoveg": "Példa classwork.",
			"tantargyId": 1, "tantargyNev": "Matematika", "oraszam": 1,
			"oraDatum": time.Now().Format("2006-01-02"), "letrehozasIdeje": now,
			"beadandoTipusId": 1, "csatolasEngedelyezesTipusId": 0, "pontszam": 0.0,
		},
	}
}



// Órai Feladatok Lekérése
func (s *Server) handleOraiFeladatLekeres(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}
	dktMu.Lock()
	out := append([]map[string]any{}, dktOraiFeladatok...)
	dktMu.Unlock()
	writeJSON(w, http.StatusOK, out)
}

// Órai Tananyagok lekérése
func (s *Server) handleDKTtananyagLekeres(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}
	dktMu.Lock()
	out := append([]map[string]any{}, dktTananyagok...)
	dktMu.Unlock()
	writeJSON(w, http.StatusOK, out)
}


// Házi feladat Megoldásának beküldése
func (s *Server) handleHazifeladatMegoldasBekuldes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}
	hwID := r.PathValue("haziFeladatId")
	var body struct {
		HaziFeladatId string `json:"haziFeladatId"`
		Szoveg        string `json:"szoveg"`
		Cim           string `json:"cim"`
	}
	_ = json.NewDecoder(io.LimitReader(r.Body, 2<<20)).Decode(&body)
	if hwID == "" {
		hwID = body.HaziFeladatId
	}
	if hwID == "" && body.Szoveg == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ures"})
		return
	}
	username, _, _, _ := sessionUser(r)
	entry := map[string]any{
		"id":            len(dktHomeworkSols) + 1,
		"haziFeladatId": hwID,
		"szoveg":        body.Szoveg,
		"cim":           body.Cim,
		"bekuldo":       username,
		"bekuldesIdeje": time.Now().UTC().Format(time.RFC3339),
		"statusz":       "beadva",
	}
	dktMu.Lock()
	dktHomeworkSols = append(dktHomeworkSols, entry)
	dktMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "solution": entry})
}

// Házi feladat Megoldásának törlése
func (s *Server) handleHazifeladatMegoldasTorles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete && r.Method != http.MethodPost {
		methodNotAllowed(w, "DELETE, POST")
		return
	}
	hwID := r.PathValue("haziFeladatId")
	if hwID == "" {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		for i, p := range parts {
			if p == "megoldasok" && i+1 < len(parts) {
				hwID = parts[i+1]
				break
			}
		}
	}
	if hwID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "haziFeladatId_hianyzik"})
		return
	}
	dktMu.Lock()
	out := make([]map[string]any, 0, len(dktHomeworkSols))
	removed := 0
	for _, s0 := range dktHomeworkSols {
		if strID(s0["haziFeladatId"]) == hwID || strID(s0["id"]) == hwID {
			removed++
			continue
		}
		out = append(out, s0)
	}
	dktHomeworkSols = out
	dktMu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "haziFeladatId": hwID, "removed": removed})
}

// Házifeladat saját Megoldások beadásának listája
func (s *Server) handleHazifeladatSajatMegoldasLista(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}
	dktMu.Lock()
	out := append([]map[string]any{}, dktHomeworkSols...)
	dktMu.Unlock()
	writeJSON(w, http.StatusOK, out)
}

func strID(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatInt(int64(t), 10)
	case int:
		return strconv.Itoa(t)
	default:
		return ""
	}
}
