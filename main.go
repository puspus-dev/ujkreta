package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
)

//go:embed static
var staticFiles embed.FS

type Server struct {
	store *Store
	auth  *AuthStore
}

func main() {
	ctx := context.Background()

	databaseURL := os.Getenv("DATABASE_URL")

	if databaseURL == "" {
		log.Fatal("DATABASE_URL nincs beállítva")
	}

	db, err := NewDB(ctx, databaseURL)
	if err != nil {
		log.Fatal(err)
	}

	defer db.Close()

	store, err := NewStore(db)
	if err != nil {
		log.Fatal(err)
	}

	s := &Server{
		store: store,
		auth:  NewAuthStore("auth.json"),
	}

	mux := http.NewServeMux()

	staticContent, err := fs.Sub(staticFiles, "static")
	if err != nil {
		log.Fatal(err)
	}

	mux.Handle(
		"/",
		http.FileServer(http.FS(staticContent)),
	)

	mux.HandleFunc(
		"/health",
		handleHealth,
	)

	mux.HandleFunc(
		"/Account/Login",
		s.handleAccountLogin,
	)

	mux.HandleFunc(
		"/ellenorzo-student/prod/oauthredirect",
		s.handleOauthRedirect,
	)

	mux.HandleFunc(
		"/connect/token",
		s.handleToken,
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/TanuloAdatlap",
		s.requireAuth(s.handleGetStudent),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/OsztalyCsoportok",
		s.requireAuth(s.handleGetClassGroups),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/FaliujsagElemek",
		s.requireAuth(s.handleGetNoticeBoard),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/Feljegyzesek",
		s.requireAuth(s.handleGetInfoBoard),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/Ertekelesek",
		s.requireAuth(s.handleGetGrades),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/Ertekelesek/Atlagok/OsztalyAtlagok",
		s.requireAuth(s.handleGetClassGroupAverages),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/OrarendElemek",
		s.requireAuth(s.handleGetTimeTable),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/Mulasztasok",
		s.requireAuth(s.handleGetOmissions),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/HaziFeladatok",
		s.requireAuth(s.handleGetHomework),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/BejelentettSzamonkeresek",
		s.requireAuth(s.handleGetTests),
	)

	mux.HandleFunc(
		"/dktapi/intezmenyek/munkaterek/tanulok",
		s.requireAuth(s.handleGetDktSubjects),
	)

	s.registerAdminRoutes(mux)

	port := os.Getenv("PORT")

	if port == "" {
		port = "8090"
	}

	addr := ":" + port

	log.Printf(
		"ujkreta server listening on %s",
		addr,
	)

	log.Fatal(
		http.ListenAndServe(
			addr,
			logRequests(mux),
		),
	)
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	w.WriteHeader(http.StatusOK)

	_, _ = w.Write(
		[]byte(`{"status":"ok"}`),
	)
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			log.Printf(
				"%s %s from %s",
				r.Method,
				r.URL.String(),
				r.RemoteAddr,
			)

			next.ServeHTTP(w, r)
		},
	)
}