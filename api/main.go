package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/render"
)

type components struct {
}

type appConfig struct {
	Port string
}

func getConfig() appConfig {
	config := appConfig{
		Port: os.Getenv("PORT"),
	}

	log.Println("Using config", config)
	return config
}

// type handler struct {
// 	// db *Images
// }

// func newHandler() handler {
// 	handler := handler{}
// 	return handler
// }

// RenderError displays errors
func RenderError(status int, err string, w http.ResponseWriter, r *http.Request) {
	errRes := Error{HTTPStatusCode: status, StatusText: err}
	errRes.Render(w, r)
	// render.Status(r, status)
	// render.JSON(w, r, err)
}

// Error is an error omg leave it alone
type Error struct {
	HTTPStatusCode int    `json:"-"`       // http response status code
	StatusText     string `json:"message"` // user-level status message
}

// Render a json error response
func (e *Error) Render(w http.ResponseWriter, r *http.Request) error {
	render.Status(r, e.HTTPStatusCode)
	render.JSON(w, r, e)
	return nil
}

// func handleGetDocuments(w http.ResponseWriter, r *http.Request) {
// 	res := getDocuments()
// 	render.JSON(w, r, res)
// }

func handleSearch(w http.ResponseWriter, r *http.Request) {
	journal := r.URL.Query().Get("journal")
	if journal == "" {
		RenderError(400, "journal and requestedId are required", w, r)
		return
	}

	// TODO: Heh, query param -> file system is super safe
	cache := newDocumentsCache(journal)
	render.JSON(w, r, cache.Search())
}

func handleSave(w http.ResponseWriter, r *http.Request) {
	// journal := r.URL.Query().Get("journal")
	// if journal == "" {
	// 	RenderError(400, "journal and requestedId are required", w, r)
	// 	return
	// }

	// entryDate := chi.URLParam(r, "entryDate")
	// if entryDate == "" {
	// 	RenderError(400, "Entry date is required", w, r)
	// 	return
	// }

	saveRequest := saveDocumentRequest{}
	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&saveRequest)

	if err != nil {
		log.Println("Error decoding JSON", err)
		return
	}

}

func handleFindByDate(w http.ResponseWriter, r *http.Request) {
	journal := r.URL.Query().Get("journal")
	if journal == "" {
		RenderError(400, "journal and requestedId are required", w, r)
		return
	}

	entryDate := chi.URLParam(r, "entryDate")
	if entryDate == "" {
		RenderError(400, "Entry date is required", w, r)
		return
	}

	cache := newDocumentsCache(journal)
	docResult := cache.findByDate(entryDate)
	if docResult == nil {
		RenderError(404, "Entry n ot found", w, r)
	}

	render.Status(r, 200)
	render.JSON(w, r, docResult)
}

func main() {
	router := chi.NewRouter()

	// dbHandle, err := db.Init()
	// if err != nil {
	// 	panic(err)
	// }

	// err = db.Create(dbHandle)
	// if err != nil {
	// 	panic(err)
	// }

	// ls := handlers.New(dbHandle)
	// handler := handlers.NewListsHandler(ls)

	// Basic CORS
	// for more ideas, see: https://developer.github.com/v3/#cross-origin-resource-sharing
	cors := cors.New(cors.Options{
		// AllowedOrigins: []string{"https://foo.com"}, // Use this to allow specific origin hosts
		// todo: https://hn-jobs.io in prod, * in dev
		AllowedOrigins: []string{"*"},
		// AllowOriginFunc:  func(r *http.Request, origin string) bool { return true },
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300, // Maximum value not ignored by any of major browsers
	})

	router.Use(cors.Handler)
	router.Use(middleware.RequestID)
	router.Use(middleware.Logger)
	router.Use(middleware.Recoverer)
	router.Use(middleware.URLFormat)
	router.Use(render.SetContentType(render.ContentTypeJSON))
	// router.Get("/documents", handleGetDocuments)
	router.Get("/search", handleSearch)

	router.Get("/findByDate/{entryDate}", handleFindByDate)
	router.Post("/save", handleSave)
	// router.Get("/mark", handler.Mark)
	// router.Get("/sync", handler.Sync)
	// // todo: rename: getAll
	// router.Get("/syncitems", handler.SyncToItem)
	// router.Get("/events", handler.Event)
	// router.Get("/lists/{ID}", handler.ServeJobsFile)

	// https://www.darkcoding.net/software/systemd-socket-activation-in-go/
	if os.Getenv("LISTEN_PID") != strconv.Itoa(os.Getpid()) {
		log.Println("(dev) Listening on 8001")
		http.ListenAndServe(":8001", router)
	}

	// systemdRun(router)
}

// func getHTTPSocket() net.Listener {
// 	f := os.NewFile(3, "hopefully 80 from systemd")
// 	l, err := net.FileListener(f)
// 	if err != nil {
// 		log.Fatal(err)
// 	}

// 	return l
// }

// // https://gist.github.com/samthor/5ff8cfac1f80b03dfe5a9be62b29d7f2
// func cacheDir() (dir string) {
// 	u, err := user.Current()
// 	if err != nil {
// 		log.Fatal(err)
// 	}

// 	dir = filepath.Join(os.TempDir(), "cache-golang-autocert-"+u.Username)
// 	if err := os.MkdirAll(dir, 0700); err == nil {
// 		return dir
// 	}

// 	log.Fatal(err)
// 	return ""
// }

// func getTLSSocket() net.Listener {
// 	f := os.NewFile(4, "hopefully 443 from systemd")
// 	l, err := net.FileListener(f)
// 	if err != nil {
// 		log.Fatal(err)
// 	}

// 	return l
// }
