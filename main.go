```go
package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
)

// A static könyvtár beágyazása.
// Ha a frontend GitHub Pages-en van, ezt a részt később akár teljesen
// el is hagyhatjuk, de az /old és egyéb lokális frontendek miatt marad.
var (
	//go:embed static
	staticFiles embed.FS
)

type Server struct {
	store *Store
	auth  *AuthStore
}

func main() {
	ctx := context.Background()

	// ------------------------------------------------------------
	// PostgreSQL
	// ------------------------------------------------------------

	databaseURL := os.Getenv("DATABASE_URL")

	if databaseURL == "" {
		log.Fatal("DATABASE_URL nincs beállítva")
	}

	db, err := NewDB(ctx, databaseURL)
	if err != nil {
		log.Fatalf("adatbázis inicializálása sikertelen: %v", err)
	}

	defer db.Close()

	log.Println("PostgreSQL kapcsolat létrejött")

	// ------------------------------------------------------------
	// Store
	// ------------------------------------------------------------

	store := NewStore(db)

	// ------------------------------------------------------------
	// Auth
	// ------------------------------------------------------------

	auth := NewAuthStore("auth.json")

	server := &Server{
		store: store,
		auth:  auth,
	}

	// ------------------------------------------------------------
	// HTTP router
	// ------------------------------------------------------------

	mux := http.NewServeMux()

	// ------------------------------------------------------------
	// Health
	// ------------------------------------------------------------

	mux.HandleFunc("/health", handleHealth)

	// ------------------------------------------------------------
	// Authentication
	// ------------------------------------------------------------

	mux.HandleFunc(
		"/Account/Login",
		server.handleAccountLogin,
	)

	mux.HandleFunc(
		"/ellenorzo-student/prod/oauthredirect",
		server.handleOauthRedirect,
	)

	mux.HandleFunc(
		"/connect/token",
		server.handleToken,
	)

	// ------------------------------------------------------------
	// Student API
	// ------------------------------------------------------------

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/TanuloAdatlap",
		server.requireAuth(
			server.handleGetStudent,
		),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/OsztalyCsoportok",
		server.requireAuth(
			server.handleGetClassGroups,
		),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/FaliujsagElemek",
		server.requireAuth(
			server.handleGetNoticeBoard,
		),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/Feljegyzesek",
		server.requireAuth(
			server.handleGetInfoBoard,
		),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/Ertekelesek",
		server.requireAuth(
			server.handleGetGrades,
		),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/Ertekelesek/Atlagok/OsztalyAtlagok",
		server.requireAuth(
			server.handleGetClassGroupAverages,
		),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/OrarendElemek",
		server.requireAuth(
			server.handleGetTimeTable,
		),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/Mulasztasok",
		server.requireAuth(
			server.handleGetOmissions,
		),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/HaziFeladatok",
		server.requireAuth(
			server.handleGetHomework,
		),
	)

	mux.HandleFunc(
		"/ellenorzo/v3/sajat/BejelentettSzamonkeresek",
		server.requireAuth(
			server.handleGetTests,
		),
	)

	// ------------------------------------------------------------
	// DKT
	// ------------------------------------------------------------

	mux.HandleFunc(
		"/dktapi/intezmenyek/munkaterek/tanulok",
		server.requireAuth(
			server.handleGetDktSubjects,
		),
	)

	// ------------------------------------------------------------
	// Admin API
	// ------------------------------------------------------------

	server.registerAdminRoutes(mux)

	// ------------------------------------------------------------
	// Static files
	// ------------------------------------------------------------

	staticContent, err := fs.Sub(
		staticFiles,
		"static",
	)

	if err != nil {
		log.Fatalf(
			"static könyvtár megnyitása sikertelen: %v",
			err,
		)
	}

	// A lokális static frontend kiszolgálása.
	//
	// Ha a GitHub Pages az elsődleges frontend, ez nem zavarja
	// a Render API működését.
	mux.Handle(
		"/",
		http.FileServer(
			http.FS(staticContent),
		),
	)

	// ------------------------------------------------------------
	// Port
	// ------------------------------------------------------------

	port := os.Getenv("PORT")

	if port == "" {
		port = "8090"
	}

	addr := ":" + port

	// ------------------------------------------------------------
	// Server
	// ------------------------------------------------------------

	log.Printf(
		"ujkreta server listening on %s",
		addr,
	)

	handler := cors(
		logRequests(mux),
	)

	serverHTTP := &http.Server{
		Addr:              addr,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	log.Fatal(
		serverHTTP.ListenAndServe(),
	)
}

// ------------------------------------------------------------
// CORS
// ------------------------------------------------------------

func cors(next http.Handler) http.Handler {
	return http.HandlerFunc(
		func(
			w http.ResponseWriter,
			r *http.Request,
		) {
			origin := r.Header.Get("Origin")

			// A GitHub Pages frontend engedélyezése.
			if origin == "https://puspus-dev.github.io" {
				w.Header().Set(
					"Access-Control-Allow-Origin",
					origin,
				)

				w.Header().Set(
					"Access-Control-Allow-Credentials",
					"true",
				)

				w.Header().Set(
					"Access-Control-Allow-Headers",
					"Authorization, Content-Type, Accept",
				)

				w.Header().Set(
					"Access-Control-Allow-Methods",
					"GET, POST, PUT, DELETE, OPTIONS",
				)

				w.Header().Set(
					"Vary",
					"Origin",
				)
			}

			// Preflight request.
			if r.Method == http.MethodOptions {
				w.WriteHeader(
					http.StatusNoContent,
				)

				return
			}

			next.ServeHTTP(w, r)
		},
	)
}

// ------------------------------------------------------------
// Health endpoint
// ------------------------------------------------------------

func handleHealth(
	w http.ResponseWriter,
	r *http.Request,
) {
	if r.Method != http.MethodGet {
		w.WriteHeader(
			http.StatusMethodNotAllowed,
		)

		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json; charset=utf-8",
	)

	w.WriteHeader(
		http.StatusOK,
	)

	_, _ = w.Write(
		[]byte(`{"status":"ok"}`),
	)
}

// ------------------------------------------------------------
// Request logging
// ------------------------------------------------------------

func logRequests(
	next http.Handler,
) http.Handler {
	return http.HandlerFunc(
		func(
			w http.ResponseWriter,
			r *http.Request,
		) {
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
```
