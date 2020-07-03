package main

import (
	"bytes"
	"io"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/util"
)

// Document is a thing
type Document interface {
	Save()
	Create()
}

type document struct {
	Path    string `json:"path"`
	DateStr string `json:"dateStr"`
	Content string `json:"content"`
	HTML    string `json:"html"`
}

type documentsResponse struct {
	Docs []*document `json:"docs"`
}

type docReference struct {
	Path    string
	DateStr string // iso8601
}

type searchResult struct {
	Count   int      `json:"count"`
	Journal string   `json:"journal"` // searched folders
	Results []string `json:"results"` // slice of what? dates?
}

type documentsCache struct {
	journal      string
	cachedSearch []*docReference
}

// SearchQuery is how DocsService can be searched...
// type SearchQuery struct {
// 	Journals []string `json:"journals"`
// 	Text     string   `json:"text"`
// 	Filters  []string `json:"filters"`
// }

// DocsService represents all operations related to finding,
// searching, saving, updating documents.
// type DocsService interface {
// 	// Find journal documents
// 	Search(s SearchQuery) searchResult

// 	// Walk folder to find journal documents
// 	Load(journal string)
// }

func newDocumentsCache(journal string) documentsCache {
	return documentsCache{journal: journal}
}

// type ByDateDesc []docReference

// func (a ByDateDesc) Len() int           { return len(a) }
// func (a ByDateDesc) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
// func (a ByDateDesc) Less(i, j int) bool { return a[i].DateStr < a[j].DateStr }
type docResult struct {
	HTML    string `json:"html"`
	Raw     string `json:"raw"`
	DateStr string `json:"date"`
}

func (dc *documentsCache) findByDate(date string) *docResult {
	matcher := regexp.MustCompile(`\d{4}-\d{2}-\d{2}`)
	match := matcher.FindString(date)
	if match == "" {
		return nil
	}

	docs := dc.findOrGetFromCache()
	searchMap := make(map[string]string)
	for _, v := range docs {
		searchMap[matcher.FindString(v.DateStr)] = v.Path
	}

	path := searchMap[match]

	html, content := getMarkdown(path)
	return &docResult{HTML: html, Raw: content, DateStr: match}
}

type saveDocumentRequest struct {
	Journal string `json:"journal"`
	Date    string `json:"date"`
	Content string `json:"content"`
}

func (dc *documentsCache) Save(journal string, date string, content string) {
	log.Println("Would save")
	log.Println(journal)
	log.Println(date)
	log.Println(content)
}

func (dc *documentsCache) Search() *searchResult {
	docs := dc.findOrGetFromCache()

	// convert slice of documents references to just their dates..
	results := make([]string, 0)
	for _, v := range docs {
		results = append(results, v.DateStr)
	}

	return &searchResult{
		Count: len(docs),

		// for now, dc has only one journal and search only searches on journal
		Journal: dc.journal,
		Results: results,
	}
}

func (dc *documentsCache) findOrGetFromCache() []*docReference {
	if dc.cachedSearch != nil {
		return dc.cachedSearch
	}

	docs := dc.findAll()
	sort.Slice(docs, func(i, j int) bool {
		return docs[i].DateStr > docs[j].DateStr
	})
	dc.cachedSearch = docs
	return docs
}

func (dc *documentsCache) findAll() []*docReference {
	matcher, err := regexp.Compile(`\d{4}-\d{2}-\d{2}.md`)
	if err != nil {
		log.Fatal(err)
		panic("Could not create regexp to match filenames")
	}

	docs := make([]*docReference, 0)

	filepath.Walk(dc.journal, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// skip attachments directory
		if strings.Contains(path, "attachments") {
			return filepath.SkipDir
		}

		// ignore directories
		if info.IsDir() {
			return nil
		}

		// /Users/cloverich/Google Drive/notes/chronicles/2019/11/2019-11-14.md
		// /Users/cloverich/Google Drive/notes/chronicles/2019/12/.DS_Store
		// /Users/cloverich/Google Drive/notes/chronicles/Untitled.ipynb
		// \d{4}-\d{2}-\d{2}.md
		matched := matcher.Match([]byte(path))

		if matched == false {
			return nil
		}

		filename := matcher.FindString(path)
		docs = append(docs, &docReference{Path: path, DateStr: filename})
		return nil
	})

	return docs
}

// return html and raw content
func getMarkdown(path string) (string, string) {
	var buf bytes.Buffer
	content, err := ioutil.ReadFile(path)
	if err != nil {
		panic(err)
	}

	hf := &hfASTTransformer{}

	md := goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithParserOptions(
			parser.WithASTTransformers(
				util.Prioritized(hf, 100),
			),
		),
	)

	if err = md.Convert(content, &buf); err != nil {
		panic(err)
	}

	return buf.String(), string(content)
}

// func doStuff2() {
// 	parser := blackfriday.New()
// 	content, _ := ioutil.ReadFile("/Users/cloverich/Google Drive/notes/chronicles/2020/01/2020-01-25.md")
// 	output2 := parser.Parse(content)

// 	output2.Walk(fookThis)
// }

func makeHTML(contents []string) {
	css, err := ioutil.ReadFile("style.css")
	if err != nil {
		log.Fatalln("Error reading css file")
		panic(err)
	}

	f, err := os.OpenFile("output.html",
		os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		log.Println(err)
	}
	defer f.Close()
	if _, err := f.WriteString("<html><head>"); err != nil {
		panic(err)
	}

	if _, err := f.Write(css); err != nil {
		panic(err)
	}

	if _, err := f.WriteString("</head><body style=\"margin-left: auto; margin-right: auto; max-width: 42.25rem; padding: 2.4375rem 1.21875rem; display: flex; flex-direction: column; justify-content: space-between; height: 100%;\">"); err != nil {
		panic(err)
	}

	for _, content := range contents {
		if _, err := f.WriteString(content); err != nil {
			panic(err)
		}
	}

	if _, err := f.WriteString("</body></html>"); err != nil {
		panic(err)
	}
}

func getDocuments() documentsResponse {

	matcher, err := regexp.Compile(`\d{4}-\d{2}-\d{2}.md`)
	if err != nil {
		log.Fatal(err)
		panic("Could not create regexp to match filenames")
	}

	paths := make([]string, 0)

	filepath.Walk("/Users/cloverich/Google Drive/notes/chronicles", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if strings.Contains(path, "attachments") {
			return filepath.SkipDir
		}

		if info.IsDir() {
			return nil
		}

		// /Users/cloverich/Google Drive/notes/chronicles/2019/11/2019-11-14.md
		// /Users/cloverich/Google Drive/notes/chronicles/2019/12/.DS_Store
		// /Users/cloverich/Google Drive/notes/chronicles/Untitled.ipynb
		// \d{4}-\d{2}-\d{2}.md
		matched, err := regexp.Match(`\d{4}-\d{2}-\d{2}.md`, []byte(path))

		if err != nil {
			log.Fatalln(err)
		}

		if matched {
			paths = append(paths, path)
			if len(paths) >= 5 {
				return io.EOF
			}
		}

		return nil
	})

	docResponse := documentsResponse{Docs: make([]*document, 0)}
	// With paths, make objects..
	for _, path := range paths {
		filename := matcher.FindString(path)
		html, content := getMarkdown(path)
		doc := document{Content: content, Path: path, DateStr: filename, HTML: html}
		docResponse.Docs = append(docResponse.Docs, &doc)
	}

	return docResponse

	// res, err := json.MarshalIndent(docResponse, "", "    ")
	// if err != nil {
	// 	panic(err)
	// }
	// return res
}
