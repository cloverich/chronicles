import React, {
  useState,
  useEffect,
  useCallback,
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
import { autorun } from "mobx";

// I am lazy
type Func<T, U = any> = (args: T) => U;

export interface JournalsState {
  loading: boolean;
  error: Error | null;
  journals: IJournal[];
  addJournal: (journal: IJournal, propagate: boolean) => any;
  removeJournal: Func<IJournal>;
  adding: boolean;
}

type LoadingState = {
  setLoading: Func<boolean>;
  setError: Func<Error | null>;
} & (
  | { error: Error; loading: false }
  | { error: null; loading: false }
  | { error: null; loading: true }
);

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

// exported for testing
export const docs = new DocsStore();

/**
 * Re-usable state for loading and errors
 * @param defaultLoading
 * @param defaultError
 */
function useLoading(
  defaultLoading = true,
  defaultError = undefined
): LoadingState {
  const [loading, setLoading] = useState<boolean>(defaultLoading);
  const [error, setError] = useState<Error | undefined | null>(defaultError);
  return { loading, setLoading, error, setError } as LoadingState;
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
      // todo: wrap in useEffect, only setLoading / Error / Toast afterwards
      // if still mounted.
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

  async function addJournal(journal: IJournal, propagate = false) {
    setAdding(true);
    setError(null);
    try {
      const updatedList = await client.journals.add(journal);
      setJournals(updatedList);
      setAdding(false);
    } catch (err) {
      setAdding(false);

      // My god this is ugly
      if (err instanceof ky.HTTPError) {
        try {
          // Basically if the error comes from my backend, pull out the
          // error title then propagate. Client library should handle this.
          const json = await err.response.json();
          err = new Error(json.title);
        } catch (jsonError) {
          // at this point, rely on outer error handler
        }
      }

      setError(err);

      // Should propagate error, so caller can try / catch
      // instead of observing adding / error
      // I _really_ hate this...
      if (propagate) throw err;
    }
  }

  async function removeJournal(journal: IJournal) {
    setAdding(true);
    setError(null);
    try {
      const updatedList = await client.journals.remove(journal);
      setJournals(updatedList);
      setAdding(false);
    } catch (err) {
      setAdding(false);
      setError(err);

      // see comments above on saving.
      throw err;
    }
  }

  async function loadJournals() {
    setLoading(true);
    setJournals(await client.journals.list());
    setLoading(false);
  }

  useEffect(() => {
    loadJournals();
  }, []);

  return { loading, error, journals, addJournal, removeJournal, adding };
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
  const { loading, setLoading, error, setError } = useLoading(false);
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
        return;
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
export type DocumentState =
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
  consumer?: string;
};

export function useDocument(
  journal: string,
  date: string,
  opts: Partial<UseDocumentOpts> = {}
) {
  const [record] = useState(
    docs.loadDocument({
      journalName: journal,
      date,
      isCreate: opts.isCreate,
    })
  );

  return record;
}

// https://stackoverflow.com/questions/53215285/how-can-i-force-component-to-re-render-with-hooks-in-react
function useForceUpdate() {
  const [, setTick] = useState(0);
  const update = useCallback(() => {
    setTick((tick) => tick + 1);
  }, []);
  return update;
}

let lastId = 0;

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

export function useEditableDocument(
  journal: string,
  date?: string,
  isUsing?: boolean
) {
  const [dateToUse] = useState(date || getToday());

  // this is safe to run on every render
  const doc = useDocument(journal, dateToUse, {
    // todo: Actually -- createIfNotExist
    isCreate: true,
    refresh: isUsing,
  });

  // Editor gets a copy of the documents contents.
  const [value, setValue] = useState<Node[]>(EditHelper.nodify(doc?.data?.raw));
  const [isDirty, setDirty] = useState(false);

  const setEditorValue = (v: Node[]) => {
    setDirty(true);
    setValue(v);
  };

  // once document is loaded... need to sert value...
  useEffect(() => {
    const dispoable = autorun(() => {
      console.log("autorun gogogo");

      // may also need to ensure this only runs...
      // not when saving... it shouldnt'
      if (!doc.loading && doc.data) {
        setValue(EditHelper.nodify(doc.data.raw));
      }
    });

    return dispoable;
  }, [journal, date]);

  const { wrapper: saveDocument, ...savingState } = withLoading(async () => {
    await docs.saveDocument({
      date: dateToUse,
      journalName: journal,
      // todo: this is duplicated from document.tsx
      raw: EditHelper.stringify(value),
    });
    setDirty(false);
  });

  return {
    doc,
    date: dateToUse,
    value,
    setValue: setEditorValue,
    isDirty,
    saveDocument,
    savingState,
  };
}
