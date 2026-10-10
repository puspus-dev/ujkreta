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

// Órai Feladat lekérés
func (s *Server) handleOraiFeladatLekeres(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	// Lista
	out := []map[string]any{
	"csatolasEngedelyezesTipusId": 0,
	"csoportId": 0,
	"osztalyId": 0,
	"osztalyNev": "",
	"letrehozasIdeje": "",
	"alkalmazottId": 0,
	"groupId": "",
	"id": 0,
	"idotartamPerc": 0,
	"oraDatum": "",
	"oraszam": 0,
	"oraIdopont": "",
	"pontszam": 0.0,
	"tantargyKategoriaId": "",
	"tantargyId": 0,
	"tantargyNev": "",
	"beadandoTipusId": 0,
	"alkalmazottNev": "",
	"szoveg": "",
	"cim": "",
	"csatolasEngedelyezesTipusId": ""
	}

// Házi feladat beküldés	
func (s *Server) handleHazifeladatMegoldasBekuldes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}

	// 1) Bejövő JSON kiolvasása
	var body struct {
		HaziFeladatId string `json:"haziFeladatId"`
		Szoveg        string `json:"szoveg"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}

	// 2) Ha semmi nincs benne → hiba
	if body.HaziFeladatId == "" && body.Szoveg == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ures"})
		return
	}

	// 3) Válasz: megkaptuk
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"haziFeladatId": body.HaziFeladatId,
		"szoveg":        body.Szoveg,
	})
}

// Beadott házi feladat törlése 
func (s *Server) handleHazifeladatMegoldasTorles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		methodNotAllowed(w, "DELETE")
		return
	}

	beadasID := r.PathValue("haziFeladatId")
	fajlID := r.PathValue("id")

	
	if beadasID == "" || fajlID == "" {
		parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		for i := 0; i < len(parts)-1; i++ {
			if parts[i] == "beadasok" {
				beadasID = parts[i+1]
			}
			if parts[i] == "fajlok" {
				fajlID = parts[i+1]
			}
		}
	}

	if beadasID == "" || fajlID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id_hianyzik"})
		return
	}

	
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":                  true,
		"haziFeladatId": beadasID,
		"fajlId":              fajlID,
	})
}

// DKT Tananyag lekérés
func (s *Server) handleDKTtananyagLekeres(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w, "POST")
		return
	}

	
	var body struct {
	"osztalyId": 0,
	"feladatId": 0,
	"datum": "x",
	"alkalmazottId": 0,
	"csoportId": 0,
	"oraszam": 0,
	"tantargyId": 0,
	"idopont": ""
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}

	
	if body.Cim == "" && body.Szoveg == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "ures"})
		return
	}

	
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"item": body,
	})
}