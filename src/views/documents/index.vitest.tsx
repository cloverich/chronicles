import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { runInAction } from "mobx";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { createMemoryNotesClient } from "../../contract/memory";
import { JournalsStore } from "../../hooks/stores/journals";
import { ApplicationContext } from "../../hooks/useApplicationStore";
import type { IClient, SearchResponse } from "../../hooks/useClient";
import { NotesContext } from "../../hooks/useNotes";
import type { SearchRequest } from "../../preload/client/types";
import { SearchStore, SearchStoreContext } from "./SearchStore";
import Documents from "./index";

const WORK_ID = "03awvyp9xobkv9t1jmmtiz0bp";

const baseDocs = [
  {
    id: "doc-1",
    title: "First note",
    journal: "work",
    createdAt: "2026-03-10T09:00:00.000Z",
  },
  {
    id: "doc-2",
    title: "Second note",
    journal: "work",
    createdAt: "2026-03-09T09:00:00.000Z",
  },
];

type SearchClientError = Error | { message: string; code?: string };

function createClient({
  searchDocs = [],
  searchError = null,
}: {
  searchDocs?: typeof baseDocs;
  searchError?: SearchClientError | null;
} = {}) {
  const search = vi.fn<(q?: SearchRequest) => Promise<SearchResponse>>(
    async () => {
      if (searchError) throw searchError;
      return { data: [...searchDocs] };
    },
  );

  const client = {
    settings: {
      get: vi.fn(async () => "work"),
      setMany: vi.fn(),
    },
    journals: {
      list: vi.fn(async () => []),
      listWithCounts: vi.fn(async () => []),
      create: vi.fn(),
      rename: vi.fn(),
      archive: vi.fn(),
      unarchive: vi.fn(),
      remove: vi.fn(),
    },
    documents: {
      search,
      searchCount: vi.fn(async () => searchDocs.length),
      deindexJournal: vi.fn(),
    },
  };

  const notes = {
    ...createMemoryNotesClient(),
    searchNotes: vi.fn(async () => {
      if (searchError) throw searchError;
      return {
        items: searchDocs.map((d) => ({
          id: d.id,
          journalId: WORK_ID,
          title: d.title,
          createdAt: d.createdAt,
        })),
      };
    }),
    countNotes: vi.fn(async () => ({ count: searchDocs.length })),
  };

  return { ...client, notes } as unknown as Pick<
    IClient,
    "settings" | "journals" | "documents" | "notes"
  >;
}

function createApplicationStore(overrides: Record<string, unknown> = {}) {
  const client = createClient() as IClient;
  const journals = new JournalsStore(
    createMemoryNotesClient(),
    client.settings,
    [
      {
        id: WORK_ID,
        name: "work",
        archived: false,
        noteCount: 2,
      },
    ],
    "work",
  );

  return {
    journals,
    preferences: {
      onboarding: "complete",
    },
    togglePreferences: vi.fn(),
    isPreferencesOpen: false,
    ...overrides,
  } as any;
}

function createSearchStore({
  docs = [],
  count = 0,
  loading = false,
  error = null,
  nextId = null,
  lastIds = [],
  searchError = null,
}: {
  docs?: typeof baseDocs;
  count?: number;
  loading?: boolean;
  error?: string | null;
  nextId?: string | null;
  lastIds?: Array<string | undefined>;
  searchError?: SearchClientError | null;
} = {}) {
  const applicationStore = createApplicationStore();
  const client = createClient({ searchDocs: docs, searchError });
  const searchStore = new SearchStore(
    client.notes,
    applicationStore.journals,
    vi.fn(),
    [],
    { lastRepairTime: null },
  );

  runInAction(() => {
    searchStore.docs = docs;
    searchStore.count = count;
    searchStore.loading = loading;
    searchStore.error = error;
    searchStore.nextId = nextId;
    searchStore.lastIds = lastIds;
  });

  return { searchStore, applicationStore, client };
}

function renderDocuments({
  applicationStore,
  searchStore,
}: {
  applicationStore: any;
  searchStore: SearchStore;
}) {
  return render(
    <MemoryRouter>
      <NotesContext.Provider value={createMemoryNotesClient()}>
        <ApplicationContext.Provider value={applicationStore}>
          <SearchStoreContext.Provider value={searchStore}>
            <Documents />
          </SearchStoreContext.Provider>
        </ApplicationContext.Provider>
      </NotesContext.Provider>
    </MemoryRouter>,
  );
}

describe("Documents surface", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it("renders the loading state", () => {
    const { searchStore, applicationStore } = createSearchStore({
      loading: true,
    });

    renderDocuments({ searchStore, applicationStore });

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Loading documents");
  });

  it("renders the empty state when no journals exist", () => {
    const { searchStore } = createSearchStore();
    const applicationStore = createApplicationStore({
      journals: new JournalsStore(
        createMemoryNotesClient(),
        (createClient() as IClient).settings,
        [],
        "",
      ),
    });

    renderDocuments({ searchStore, applicationStore });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No journals added");
    expect(alert).toHaveTextContent("create a new journal");
  });

  it("renders search results through the real layout and item components", () => {
    const { searchStore, applicationStore } = createSearchStore({
      count: 2,
      docs: baseDocs,
    });

    renderDocuments({ searchStore, applicationStore });

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText(/\[2 DOCS FOUND\]/i)).toBeInTheDocument();
    expect(screen.getByText("First note")).toBeInTheDocument();
    expect(screen.getByText("Second note")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /\/work/i })).toHaveLength(2);
  });

  it("adds an in: token when a journal chip is clicked", async () => {
    const { searchStore, applicationStore } = createSearchStore({
      count: 1,
      docs: [baseDocs[0]],
    });

    renderDocuments({ searchStore, applicationStore });

    fireEvent.click(screen.getByRole("button", { name: /\/work/i }));

    await waitFor(() => {
      expect(searchStore.searchTokens).toContain("in:work");
    });
  });

  it("renders search error state from a client search failure", async () => {
    const { searchStore, applicationStore, client } = createSearchStore({
      loading: true,
      searchError: new Error("boom"),
    });

    renderDocuments({ searchStore, applicationStore });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Search failed");
      expect(alert).toHaveTextContent("boom");
    });

    expect(client.notes.searchNotes).toHaveBeenCalled();
  });

  it("invokes pagination behavior and scrolls to top", () => {
    const { searchStore, applicationStore } = createSearchStore({
      count: 1,
      docs: [baseDocs[0]],
      nextId: "doc-2",
      lastIds: ["seed-before"],
    });

    renderDocuments({ searchStore, applicationStore });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /prev/i }));

    expect(window.scrollTo).toHaveBeenCalledTimes(2);
    expect(window.scrollTo).toHaveBeenNthCalledWith(1, 0, 0);
    expect(window.scrollTo).toHaveBeenNthCalledWith(2, 0, 0);
  });
});
