package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ============================================================
// Kérdőívek (e-Ügyintézés) – tanár készít, diák kitölt
// main.go: server.registerSurveyRoutes(mux)
// ============================================================

type SurveyQuestion struct {
	ID      int      `json:"id"`
	Text    string   `json:"text"`
	Type    string   `json:"type"` // text | single | multi
	Options []string `json:"options,omitempty"`
	Required bool    `json:"required"`
}

type Survey struct {
	ID          int              `json:"id"`
	Title       string           `json:"title"`
	Description string           `json:"description,omitempty"`
	CreatedBy   string           `json:"createdBy"`
	CreatedAt   string           `json:"createdAt"`
	Active      bool             `json:"active"`
	Questions   []SurveyQuestion `json:"questions"`
}

type SurveyAnswer struct {
	QuestionID int      `json:"questionId"`
	Value      string   `json:"value,omitempty"`
	Values     []string `json:"values,omitempty"`
}

type SurveyResponse struct {
	ID        int            `json:"id"`
	SurveyID  int            `json:"surveyId"`
	Username  string         `json:"username"`
	StudentUID string        `json:"studentUid,omitempty"`
	SubmittedAt string       `json:"submittedAt"`
	Answers   []SurveyAnswer `json:"answers"`
}

type surveyMem struct {
	mu        sync.Mutex
	nextSID   int
	nextRID   int
	surveys   []Survey
	responses []SurveyResponse
}

var globalSurveys = &surveyMem{nextSID: 1, nextRID: 1}

func (s *Store) ensureSurveySchema() {
	ctx := context.Background()
	_, err := s.db.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS surveys (
			id SERIAL PRIMARY KEY,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			created_by TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			active BOOLEAN NOT NULL DEFAULT TRUE,
			questions_json TEXT NOT NULL DEFAULT '[]'
		);
		CREATE TABLE IF NOT EXISTS survey_responses (
			id SERIAL PRIMARY KEY,
			survey_id INT NOT NULL,
			username TEXT NOT NULL DEFAULT '',
			student_uid TEXT NOT NULL DEFAULT '',
			submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			answers_json TEXT NOT NULL DEFAULT '[]',
			UNIQUE(survey_id, username)
		);
	`)
	if err != nil {
		log.Printf("ensureSurveySchema: %v (memory fallback ok)", err)
	}
}

func (s *Server) registerSurveyRoutes(mux *http.ServeMux) {
	s.store.ensureSurveySchema()

	// list / create
	mux.HandleFunc("/integration-kretamobile-api/v1/kerdoivek", s.handleSurveysRoot)
	mux.HandleFunc("/integration-kretamobile-api/v1/kerdoivek/", s.handleSurveyByID)

	// alias shorter paths
	mux.HandleFunc("/api/surveys", s.handleSurveysRoot)
	mux.HandleFunc("/api/surveys/", s.handleSurveyByID)
}

func (s *Server) handleSurveysRoot(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleListSurveys(w, r)
	case http.MethodPost:
		s.handleCreateSurvey(w, r)
	default:
		methodNotAllowed(w, "GET, POST")
	}
}

func (s *Server) handleSurveyByID(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	// .../kerdoivek/{id} or .../kerdoivek/{id}/valaszok or .../submit
	rest := path
	for _, pfx := range []string{
		"/integration-kretamobile-api/v1/kerdoivek/",
		"/api/surveys/",
	} {
		if strings.HasPrefix(path, pfx) {
			rest = strings.TrimPrefix(path, pfx)
			break
		}
	}
	rest = strings.Trim(rest, "/")
	parts := strings.Split(rest, "/")
	if len(parts) == 0 || parts[0] == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing_id"})
		return
	}
	id, err := strconv.Atoi(parts[0])
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_id"})
		return
	}

	if len(parts) >= 2 && (parts[1] == "valaszok" || parts[1] == "responses") {
		if r.Method != http.MethodGet {
			methodNotAllowed(w, "GET")
			return
		}
		s.handleListResponses(w, r, id)
		return
	}
	if len(parts) >= 2 && (parts[1] == "kitolt" || parts[1] == "submit") {
		if r.Method != http.MethodPost {
			methodNotAllowed(w, "POST")
			return
		}
		s.handleSubmitSurvey(w, r, id)
		return
	}

	switch r.Method {
	case http.MethodGet:
		s.handleGetSurvey(w, r, id)
	case http.MethodDelete:
		s.handleDeleteSurvey(w, r, id)
	case http.MethodPut, http.MethodPatch:
		s.handleToggleSurvey(w, r, id)
	default:
		methodNotAllowed(w, "GET, DELETE, PUT")
	}
}

func sessionUser(r *http.Request) (username, role, studentUID string, ok bool) {
	sess, ok2 := sessionFromRequest(r)
	if !ok2 {
		return "", "", "", false
	}
	return sess.Username, sess.Role, sess.UserID, true
}

func isTeacherRole(role string) bool {
	r := strings.TrimSpace(role)
	return r == "Tanar" || r == "Osztalyfonok" || r == RoleTeacher
}

func (s *Server) handleListSurveys(w http.ResponseWriter, r *http.Request) {
	username, role, _, ok := sessionUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	list := s.loadSurveys()
	// diák: csak active; tanár: mind
	out := make([]map[string]any, 0)
	for _, sv := range list {
		if !isTeacherRole(role) && !sv.Active {
			continue
		}
		filled := s.hasResponse(sv.ID, username)
		out = append(out, map[string]any{
			"id":          sv.ID,
			"title":       sv.Title,
			"description": sv.Description,
			"createdBy":   sv.CreatedBy,
			"createdAt":   sv.CreatedAt,
			"active":      sv.Active,
			"questionCount": len(sv.Questions),
			"filled":      filled,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleGetSurvey(w http.ResponseWriter, r *http.Request, id int) {
	_, _, _, ok := sessionUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	sv, found := s.getSurvey(id)
	if !found {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	}
	writeJSON(w, http.StatusOK, sv)
}

func (s *Server) handleCreateSurvey(w http.ResponseWriter, r *http.Request) {
	username, role, _, ok := sessionUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !isTeacherRole(role) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only_teacher_of"})
		return
	}
	var body struct {
		Title       string           `json:"title"`
		Description string           `json:"description"`
		Questions   []SurveyQuestion `json:"questions"`
		Active      *bool            `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	title := strings.TrimSpace(body.Title)
	if title == "" || len(body.Questions) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title_and_questions_required"})
		return
	}
	for i := range body.Questions {
		if body.Questions[i].ID == 0 {
			body.Questions[i].ID = i + 1
		}
		t := strings.ToLower(strings.TrimSpace(body.Questions[i].Type))
		if t != "text" && t != "single" && t != "multi" {
			t = "text"
		}
		body.Questions[i].Type = t
	}
	active := true
	if body.Active != nil {
		active = *body.Active
	}
	sv := Survey{
		Title:       title,
		Description: strings.TrimSpace(body.Description),
		CreatedBy:   username,
		CreatedAt:   time.Now().UTC().Format(time.RFC3339),
		Active:      active,
		Questions:   body.Questions,
	}
	sv = s.saveSurvey(sv)
	writeJSON(w, http.StatusCreated, sv)
}

func (s *Server) handleDeleteSurvey(w http.ResponseWriter, r *http.Request, id int) {
	_, role, _, ok := sessionUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !isTeacherRole(role) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only_teacher_of"})
		return
	}
	if !s.deleteSurvey(id) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "deleted": id})
}

func (s *Server) handleToggleSurvey(w http.ResponseWriter, r *http.Request, id int) {
	_, role, _, ok := sessionUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !isTeacherRole(role) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only_teacher_of"})
		return
	}
	var body struct {
		Active bool `json:"active"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	sv, found := s.getSurvey(id)
	if !found {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not_found"})
		return
	}
	sv.Active = body.Active
	s.updateSurvey(sv)
	writeJSON(w, http.StatusOK, sv)
}

func (s *Server) handleSubmitSurvey(w http.ResponseWriter, r *http.Request, id int) {
	username, _, studentUID, ok := sessionUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	sv, found := s.getSurvey(id)
	if !found || !sv.Active {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "survey_not_available"})
		return
	}
	if s.hasResponse(id, username) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "already_submitted"})
		return
	}
	var body struct {
		Answers []SurveyAnswer `json:"answers"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid_json"})
		return
	}
	resp := SurveyResponse{
		SurveyID:    id,
		Username:    username,
		StudentUID:  studentUID,
		SubmittedAt: time.Now().UTC().Format(time.RFC3339),
		Answers:     body.Answers,
	}
	resp = s.saveResponse(resp)
	writeJSON(w, http.StatusCreated, resp)
}

func (s *Server) handleListResponses(w http.ResponseWriter, r *http.Request, id int) {
	_, role, _, ok := sessionUser(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
		return
	}
	if !isTeacherRole(role) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "only_teacher_of"})
		return
	}
	writeJSON(w, http.StatusOK, s.listResponses(id))
}

// ---- storage (DB with memory fallback) ----

func (s *Server) loadSurveys() []Survey {
	ctx := context.Background()
	rows, err := s.store.db.Query(ctx, `
		SELECT id, title, description, created_by, created_at::text, active, questions_json
		FROM surveys ORDER BY id DESC`)
	if err != nil {
		globalSurveys.mu.Lock()
		defer globalSurveys.mu.Unlock()
		out := make([]Survey, len(globalSurveys.surveys))
		copy(out, globalSurveys.surveys)
		return out
	}
	defer rows.Close()
	var list []Survey
	for rows.Next() {
		var sv Survey
		var qj string
		if err := rows.Scan(&sv.ID, &sv.Title, &sv.Description, &sv.CreatedBy, &sv.CreatedAt, &sv.Active, &qj); err != nil {
			continue
		}
		_ = json.Unmarshal([]byte(qj), &sv.Questions)
		list = append(list, sv)
	}
	if len(list) == 0 {
		globalSurveys.mu.Lock()
		defer globalSurveys.mu.Unlock()
		out := make([]Survey, len(globalSurveys.surveys))
		copy(out, globalSurveys.surveys)
		return out
	}
	return list
}

func (s *Server) getSurvey(id int) (Survey, bool) {
	for _, sv := range s.loadSurveys() {
		if sv.ID == id {
			return sv, true
		}
	}
	return Survey{}, false
}

func (s *Server) saveSurvey(sv Survey) Survey {
	ctx := context.Background()
	qj, _ := json.Marshal(sv.Questions)
	var id int
	err := s.store.db.QueryRow(ctx, `
		INSERT INTO surveys (title, description, created_by, active, questions_json)
		VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		sv.Title, sv.Description, sv.CreatedBy, sv.Active, string(qj),
	).Scan(&id)
	if err != nil {
		globalSurveys.mu.Lock()
		defer globalSurveys.mu.Unlock()
		sv.ID = globalSurveys.nextSID
		globalSurveys.nextSID++
		globalSurveys.surveys = append(globalSurveys.surveys, sv)
		return sv
	}
	sv.ID = id
	return sv
}

func (s *Server) updateSurvey(sv Survey) {
	ctx := context.Background()
	qj, _ := json.Marshal(sv.Questions)
	_, err := s.store.db.Exec(ctx, `
		UPDATE surveys SET title=$2, description=$3, active=$4, questions_json=$5 WHERE id=$1`,
		sv.ID, sv.Title, sv.Description, sv.Active, string(qj))
	if err != nil {
		globalSurveys.mu.Lock()
		defer globalSurveys.mu.Unlock()
		for i := range globalSurveys.surveys {
			if globalSurveys.surveys[i].ID == sv.ID {
				globalSurveys.surveys[i] = sv
				break
			}
		}
	}
}

func (s *Server) deleteSurvey(id int) bool {
	ctx := context.Background()
	tag, err := s.store.db.Exec(ctx, `DELETE FROM surveys WHERE id=$1`, id)
	if err == nil && tag.RowsAffected() > 0 {
		_, _ = s.store.db.Exec(ctx, `DELETE FROM survey_responses WHERE survey_id=$1`, id)
		return true
	}
	globalSurveys.mu.Lock()
	defer globalSurveys.mu.Unlock()
	for i, sv := range globalSurveys.surveys {
		if sv.ID == id {
			globalSurveys.surveys = append(globalSurveys.surveys[:i], globalSurveys.surveys[i+1:]...)
			return true
		}
	}
	return false
}

func (s *Server) hasResponse(surveyID int, username string) bool {
	ctx := context.Background()
	var n int
	err := s.store.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM survey_responses WHERE survey_id=$1 AND username=$2`,
		surveyID, username).Scan(&n)
	if err == nil {
		return n > 0
	}
	globalSurveys.mu.Lock()
	defer globalSurveys.mu.Unlock()
	for _, r := range globalSurveys.responses {
		if r.SurveyID == surveyID && r.Username == username {
			return true
		}
	}
	return false
}

func (s *Server) saveResponse(resp SurveyResponse) SurveyResponse {
	ctx := context.Background()
	aj, _ := json.Marshal(resp.Answers)
	var id int
	err := s.store.db.QueryRow(ctx, `
		INSERT INTO survey_responses (survey_id, username, student_uid, answers_json)
		VALUES ($1,$2,$3,$4) RETURNING id`,
		resp.SurveyID, resp.Username, resp.StudentUID, string(aj),
	).Scan(&id)
	if err != nil {
		globalSurveys.mu.Lock()
		defer globalSurveys.mu.Unlock()
		resp.ID = globalSurveys.nextRID
		globalSurveys.nextRID++
		globalSurveys.responses = append(globalSurveys.responses, resp)
		return resp
	}
	resp.ID = id
	return resp
}

func (s *Server) listResponses(surveyID int) []SurveyResponse {
	ctx := context.Background()
	rows, err := s.store.db.Query(ctx, `
		SELECT id, survey_id, username, student_uid, submitted_at::text, answers_json
		FROM survey_responses WHERE survey_id=$1 ORDER BY id`, surveyID)
	if err != nil {
		globalSurveys.mu.Lock()
		defer globalSurveys.mu.Unlock()
		var out []SurveyResponse
		for _, r := range globalSurveys.responses {
			if r.SurveyID == surveyID {
				out = append(out, r)
			}
		}
		return out
	}
	defer rows.Close()
	var list []SurveyResponse
	for rows.Next() {
		var r SurveyResponse
		var aj string
		if err := rows.Scan(&r.ID, &r.SurveyID, &r.Username, &r.StudentUID, &r.SubmittedAt, &aj); err != nil {
			continue
		}
		_ = json.Unmarshal([]byte(aj), &r.Answers)
		list = append(list, r)
	}
	return list
}
