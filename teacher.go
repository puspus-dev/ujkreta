package main

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

// ============================================================
// TEACHER TYPES
// ============================================================

type Teacher struct {
	Uid                   string    `json:"Uid"`
	Nev                   string    `json:"Nev"`
	EmailCim              string    `json:"EmailCim,omitempty"`
	Telefonszam           string    `json:"Telefonszam,omitempty"`
	IntezmenyAzonosito    string    `json:"IntezmenyAzonosito"`
	IntezmenyNev          string    `json:"IntezmenyNev"`
	OsztalyFonokOsztalyok []NameUid `json:"OsztalyFonokOsztalyok"`
	Tantargyak            []Subject `json:"Tantargyak"`
}

type TeacherStudent struct {
	Uid            string  `json:"Uid"`
	Nev            string  `json:"Nev"`
	EmailCim       string  `json:"EmailCim,omitempty"`
	OsztalyCsoport NameUid `json:"OsztalyCsoport"`
}

// ============================================================
// CREATE REQUESTS
// ============================================================

type createGradeRequest struct {
	TantargyUid        string       `json:"TantargyUid"`
	Tema               string       `json:"Tema"`
	SzamErtek          int          `json:"SzamErtek"`
	SzovegesErtek      string       `json:"SzovegesErtek"`
	SulySzazalekErteke int          `json:"SulySzazalekErteke"`
	Tipus              *NameUidDesc `json:"Tipus"`
	OsztalyCsoportUid  string       `json:"OsztalyCsoportUid"`
	TanuloUid          string       `json:"TanuloUid"`
}

type createHomeworkRequest struct {
	TantargyUid       string `json:"TantargyUid"`
	Szoveg            string `json:"Szoveg"`
	Hatarido          string `json:"Hatarido"`
	OsztalyCsoportUid string `json:"OsztalyCsoportUid"`
}

type createOmissionRequest struct {
	TanuloUid         string       `json:"TanuloUid"`
	Datum             string       `json:"Datum"`
	Tipus             *NameUidDesc `json:"Tipus"`
	KesesPercben      int          `json:"KesesPercben"`
	OsztalyCsoportUid string       `json:"OsztalyCsoportUid"`
}

type createTestRequest struct {
	TantargyUid       string       `json:"TantargyUid"`
	Datum             string       `json:"Datum"`
	Modja             *NameUidDesc `json:"Modja"`
	OsztalyCsoportUid string       `json:"OsztalyCsoportUid"`
}

// ============================================================
// TEACHER ROUTES
// ============================================================

func (s *Server) registerTeacherRoutes(mux *http.ServeMux) {
	mux.HandleFunc(
		"/naplo/v3/sajat/TanarAdatlap",
		s.requireAuth(s.handleGetTeacher),
	)
	mux.HandleFunc(
		"/naplo/v3/sajat/OsztalyCsoportok",
		s.requireTeacher(s.handleTeacherClassGroups),
	)
	mux.HandleFunc(
		"/naplo/v3/sajat/Tanulok",
		s.requireTeacher(s.handleTeacherStudents),
	)
	mux.HandleFunc(
		"/naplo/v3/sajat/OrarendElemek",
		s.requireTeacher(s.handleTeacherTimetable),
	)
	mux.HandleFunc(
		"/naplo/v3/sajat/Ertekelesek",
		s.requireTeacher(s.handleTeacherGrades),
	)
	mux.HandleFunc(
		"/naplo/v3/sajat/HaziFeladatok",
		s.requireTeacher(s.handleTeacherHomework),
	)
	mux.HandleFunc(
		"/naplo/v3/sajat/Mulasztasok",
		s.requireTeacher(s.handleTeacherOmissions),
	)
	mux.HandleFunc(
		"/naplo/v3/sajat/BejelentettSzamonkeresek",
		s.requireTeacher(s.handleTeacherTests),
	)
}

// ============================================================
// GET HANDLERS
// ============================================================

func (s *Server) handleGetTeacher(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetTeacher())
}

func (s *Server) handleTeacherClassGroups(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetClassGroups())
}

func (s *Server) handleTeacherStudents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetTeacherStudents())
}

func (s *Server) handleTeacherTimetable(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w, "GET")
		return
	}

	writeJSON(w, http.StatusOK, s.store.GetLessons())
}

// ============================================================
// GRADES (GET + POST)
// ============================================================

func (s *Server) handleTeacherGrades(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.GetGrades())

	case http.MethodPost:
		var req createGradeRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "invalid_json",
			})
			return
		}

		grade, err := s.store.AddGrade(req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "grade_create_failed",
				"message": err.Error(),
			})
			return
		}

		writeJSON(w, http.StatusCreated, grade)

	default:
		methodNotAllowed(w, "GET, POST")
	}
}

// ============================================================
// HOMEWORK (GET + POST)
// ============================================================

func (s *Server) handleTeacherHomework(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.GetHomework())

	case http.MethodPost:
		var req createHomeworkRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "invalid_json",
			})
			return
		}

		hw, err := s.store.AddHomework(req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "homework_create_failed",
				"message": err.Error(),
			})
			return
		}

		writeJSON(w, http.StatusCreated, hw)

	default:
		methodNotAllowed(w, "GET, POST")
	}
}

// ============================================================
// OMISSIONS (GET + POST)
// ============================================================

func (s *Server) handleTeacherOmissions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.GetOmissions())

	case http.MethodPost:
		var req createOmissionRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "invalid_json",
			})
			return
		}

		om, err := s.store.AddOmission(req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "omission_create_failed",
				"message": err.Error(),
			})
			return
		}

		writeJSON(w, http.StatusCreated, om)

	default:
		methodNotAllowed(w, "GET, POST")
	}
}

// ============================================================
// TESTS (GET + POST)
// ============================================================

func (s *Server) handleTeacherTests(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.GetTests())

	case http.MethodPost:
		var req createTestRequest

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "invalid_json",
			})
			return
		}

		test, err := s.store.AddTest(req)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error":   "test_create_failed",
				"message": err.Error(),
			})
			return
		}

		writeJSON(w, http.StatusCreated, test)

	default:
		methodNotAllowed(w, "GET, POST")
	}
}

// ============================================================
// ADMIN TEACHER
// ============================================================

func (s *Server) handleAdminTeacher(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, s.store.GetTeacher())

	case http.MethodPut, http.MethodPost:
		var teacher Teacher

		if err := json.NewDecoder(r.Body).Decode(&teacher); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "invalid_json",
			})
			return
		}

		s.store.SetTeacher(teacher)

		writeJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"teacher": s.store.GetTeacher(),
		})

	default:
		methodNotAllowed(w, "GET, PUT, POST")
	}
}

// ============================================================
// HELPERS
// ============================================================

func nextUID(prefix string, existing int) string {
	return prefix + strconv.FormatInt(time.Now().UnixNano()%1_000_000_000, 10) + strconv.Itoa(existing)
}
