import React, { useState, useEffect } from "react";
import client, {
  IJournal,
  SearchResponse,
  SearchRequest,
  GetDocumentResponse,
} from "./client";

// I am lazy
type Func<T, U = any> = (args: T) => U;

export interface JournalsState {
  loading: boolean;
  error: Error | null;
  journals: IJournal[];
  addJournal: Func<IJournal>;
  adding: boolean;
}

interface LoadingState {
  loading: boolean;
  setLoading: Func<boolean>;
  error: Error | null;
  setError: Func<Error | null>;
}

function useLoading(defaultLoading = true, defaultError = null): LoadingState {
  const [loading, setLoading] = useState<boolean>(defaultLoading);
  const [error, setError] = useState<Error | null>(defaultError);
  return { loading, setLoading, error, setError };
}

export function useJournals(): JournalsState {
  const { loading, setLoading, error, setError } = useLoading();
  const [adding, setAdding] = useState(false);
  const [journals, setJournals] = useState<IJournal[]>([]);

  async function addJournal(journal: IJournal) {
    setAdding(true);
    setError(null);
    try {
      await client.journals.add(journal);
    } catch (err) {
      setAdding(false);
      setError(err);
    }
    setJournals(await client.journals.list());
    setAdding(false);
  }

  async function loadJournals() {
    setLoading(true);
    setJournals(await client.journals.list());
    setLoading(false);
  }

  useEffect(() => {
    loadJournals();
  }, []);

  return { loading, error, journals, addJournal, adding };
}

// Content state returned from the useContent hook
// Defining it as an interface lets components declare it
// as a prop, easily. Jibberish. Blame my booze.
export interface ContentState {
  loading: boolean;
  error: Error | null;
  query: SearchRequest | null;
  setQuery: Func<SearchRequest>;
  content: SearchResponse | null;
}

/**
 * Hook to hold query and content state
 */
export function useContent(): ContentState {
  const { loading, setLoading, error, setError } = useLoading();
  const [query, setQuery] = useState<SearchRequest | null>(null);
  const [content, setContent] = useState<SearchResponse | null>(null);

  // Search journal content whenever query changes
  // TODO: How to debounce?
  useEffect(() => {
    async function loadContent() {
      // TODO: Last query should win, and prior queries should cancel
      if (loading) {
        console.warn(
          "Not executing query because last search is still in progress"
        );
        console.warn(query);
      }
      setLoading(true);
      if (query) {
        try {
          const res = await client.docs.search(query);
          setContent(res);
        } catch (err) {
          setError(err);
          setLoading(false);
        }
      }
      setLoading(false);
    }

    loadContent();
  }, [query]);

  return { loading, error, query, setQuery, content };
}

export interface DocumentState {
  document: GetDocumentResponse | null;
  error: Error | null;
  loading: boolean;
  saveDocument: Func<string, Promise<any>>;
  saving: boolean;
  saveError: Error | null;
}

export function useDocument(journal: string, date: string): DocumentState {
  const { loading, setLoading, error, setError } = useLoading();
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [document, setDocument] = useState<GetDocumentResponse | null>(null);

  useEffect(() => {
    async function loadDocument() {
      setLoading(true);
      try {
        const docRes = await client.docs.findOne({
          journalName: journal,
          date,
        });
        setDocument(docRes);
        setError(null);
        setLoading(false);
      } catch (err) {
        setError(err);
        setLoading(false);
      }
    }

    loadDocument();
  }, [journal, date]);

  // TODO: auto-save
  // Pull out document content and setter inside hook
  // Make setter mark document as dirty
  // Setup an interval to check for dirty, and auto-save if true
  // Consider tracking status here as well
  // Consider caching original to support reverting
  async function saveDocument(content: string) {
    if (saving) return;
    setSaving(true);
    try {
      const doc = await client.docs.save({
        date,
        journalName: journal,
        raw: content,
      });
      setDocument(doc);
      setSaveError(null);
      setSaving(false);
    } catch (err) {
      setSaveError(err);
      setSaving(false);
    }
  }

  return { loading, error, document, saveDocument, saving, saveError };
}
