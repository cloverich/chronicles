import React, {
  useState,
  useEffect,
  useContext,
  Dispatch,
  SetStateAction,
} from "react";
import client, {
  IJournal,
  SearchResponse,
  SearchRequest,
  GetDocumentResponse,
} from "./client";
import { toaster } from "evergreen-ui";
import ky from "ky-universal";

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

// So this works.. but its dumb because if two hooks in this file want to use it,
// they must rely on some parent cotenxt import and Providing this context with a value
// from a different hook.
// I wonder how to write this cleanly.
// Maybe... `useJournals` should only be used in one place as well,
// in which case both this and that should be in the same Container component
// that loads them
export const JournalsContext = React.createContext<IJournal[]>([]);

// todo: inject this from a context elsewhere...
import { DocsStore } from "./client/docstore";
const docs = new DocsStore();

/**
 * Re-usable state for loading and errors
 * @param defaultLoading
 * @param defaultError
 */
function useLoading(defaultLoading = true, defaultError = null): LoadingState {
  const [loading, setLoading] = useState<boolean>(defaultLoading);
  const [error, setError] = useState<Error | null>(defaultError);
  return { loading, setLoading, error, setError };
}

/**
 * abstract the error / loading pattern into a helper that returns
 * a wrapped async function and loadingstate.
 * @param cb - The async logic to wrap. Ex: const state = withLoading(() => fetch('http://foo.com'));
 */
function withLoading(cb: () => Promise<any>) {
  const state = useLoading(false);

  const wrapper = async () => {
    if (state.loading) return;
    state.setLoading(true);
    state.setError(null);
    try {
      await cb();
      state.setLoading(false);
    } catch (err) {
      state.setError(err);
      state.setLoading(false);
      toaster.danger(err);
    }
  };

  return { loading: state.loading, error: state.error, wrapper };
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
  setQuery: Dispatch<SetStateAction<SearchRequest | null>>;
  content: SearchResponse | null;
}

/**
 * Hook to hold query and content state
 * TODO: "content" is not hte right name, its search result state
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

interface DocumentLoadedState {
  error: null;
  loading: false;
  document: GetDocumentResponse;
}

interface DocumentLoadingState {
  error: null;
  loading: true;
  document: null;
}

/**
 * The document failed to load because of an error.
 */
interface DocumentErrorState {
  error: Error;
  loading: false;
  document: null;
}

/**
 * A document request (really, any request) can actually be only one of
 * these discrete states.
 *
 * 1. Loading: Document is loading
 * 2. Error: Document failed to load
 * 3. Loaded: Document loaded succesfully (is now non-null)
 */
type DocumentLoaderState =
  | DocumentLoadedState
  | DocumentLoadingState
  | DocumentErrorState;

/**
 * Options to useDocument
 */
type UseDocumentOpts = {
  /**
   * Should it return an empty document on 404, or propagate the error?
   */
  isCreate: true;
  /**
   * A key that, when changed, will cause the load effect to re-run
   * Kind of stupid but, works for MVP
   */
  refresh: boolean;
};

export function useDocument(
  journal: string,
  date: string,
  opts: Partial<UseDocumentOpts> = {}
): DocumentState {
  const { loading, setLoading, error, setError } = useLoading();
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<Error | null>(null);
  const [document, setDocument] = useState<GetDocumentResponse | null>(null);

  useEffect(() => {
    async function loadDocument() {
      setLoading(true);
      try {
        const docRes = await docs.loadDocument({ journalName: journal, date });
        setDocument(docRes);
        setError(null);
      } catch (err) {
        // special case: creating a new document
        if (err instanceof ky.HTTPError) {
          if (err.response.status === 404 && opts.isCreate) {
            setDocument({ mdast: null, raw: "" });
          }
        } else {
          toaster.danger(`failed to load document ${err}`);
          setError(err);
        }
      }
      setLoading(false);
    }

    loadDocument();
  }, [journal, date, opts.refresh]);

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

import { Node } from "slate";

/**
 * The "New document" button needs to know what date today is.
 */
function getToday() {
  const d = new Date();
  // This isn't quite right. At 6:30 am, this makes a date
  // that is 00:30. setUTCHours is stranger. TODO: Revisit
  d.setHours(-d.getTimezoneOffset() / 60);
  return d.toISOString().slice(0, 10);
}

/**
 * The Slate editor uses nodes for its state.
 *
 * These are hacky to get it rolling, not sure what the state is supposed
 * to look like.
 */
class EditHelper {
  static stringify(node: Node[]) {
    return node.map((n: any) => Node.string(n)).join("\n");
  }

  static nodify(contents?: string) {
    return [{ children: [{ text: contents || "" }] }];
  }
}

export function useEditableDocument(journal: string, isUsing: boolean) {
  // todo: this needs to not be cached, leaving the browser open overnight
  // and using it the next morning is something I do commonly -- it cannot
  // have a reference to yesterday
  const today = getToday();
  const { document, ...rest } = useDocument(journal, today, {
    isCreate: true,
    refresh: isUsing,
  });

  // Editor gets a copy of the documents contents.
  const [value, setValue] = useState<Node[]>(EditHelper.nodify(document?.raw));

  // Anytime the document changes, the copy provided to the editor should too
  useEffect(() => {
    setValue(EditHelper.nodify(document?.raw));
  }, [document]);

  const { wrapper: saveDocument, ...savingState } = withLoading(async () => {
    await docs.saveDocument({
      date: today,
      journalName: journal,
      // todo: this is duplicated from document.tsx
      raw: EditHelper.stringify(value),
    });
  });

  return {
    ...rest,
    document,
    date: today,
    value,
    setValue,
    saveDocument,
    savingState,
  };
}
