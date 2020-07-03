package main

import (
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/text"
)

// type ASTTransformer interface {
// 	// Transform transforms the given AST tree.
// 	Transform(node *ast.Document, reader text.Reader, pc Context)
// }

type hfASTTransformer struct {
}

func (hf *hfASTTransformer) Transform(node *gast.Document, reader text.Reader, pc parser.Context) {
	// log.Println(string(node.Kind()))
	// log.Println(node.Lines())
	// b, _ := reader.PeekLine()
	// log.Println(string(b))
	// log.Println(node.ChildCount())

	// next := node.FirstChild()
	// for next != nil {
	// 	log.Println("next")
	// 	next.Dump(reader.Source(), 2)
	// 	next = next.NextSibling()
	// }
}

func (hf hfASTTransformer) String() string {
	return "I am in fact an ASTTransformer right?"
}
