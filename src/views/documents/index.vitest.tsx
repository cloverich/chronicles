import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { runInAction } from "mobx";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { JournalsStore } from "../../hooks/stores/journals";
import { ApplicationContext } from "../../hooks/useApplicationStore";
import { SearchStore, SearchStoreContext } from "./SearchStore";
import Documents from "./index";

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

function createClient({
  searchDocs = [],
  searchError = null,
}: {
  searchDocs?: typeof baseDocs;
  searchError?: string | null;
} = {}) {
  return {
    preferences: {
      get: vi.fn(async () => "work"),
      set: vi.fn(),
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
      search: vi.fn(async () => {
        if (searchError) throw new Error(searchError);
        return { data: [...searchDocs] };
      }),
      searchCount: vi.fn(async () => searchDocs.length),
      deindexJournal: vi.fn(),
    },
  } as any;
}

function createApplicationStore(overrides: Record<string, unknown> = {}) {
  const journals = new JournalsStore(
    createClient(),
    [
      {
        name: "work",
        archived: false,
        count: 2,
        createdAt: "2026-03-10T09:00:00.000Z",
        updatedAt: "2026-03-10T09:00:00.000Z",
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
  searchError?: string | null;
} = {}) {
  const applicationStore = createApplicationStore();
  const searchStore = new SearchStore(
    createClient({ searchDocs: docs, searchError }),
    applicationStore.journals,
    vi.fn(),
    [],
    { lastIndexTime: 0 },
  );

  runInAction(() => {
    searchStore.docs = docs;
    searchStore.count = count;
    searchStore.loading = loading;
    searchStore.error = error;
    searchStore.nextId = nextId;
    searchStore.lastIds = lastIds;
  });

  return { searchStore, applicationStore };
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
      <ApplicationContext.Provider value={applicationStore}>
        <SearchStoreContext.Provider value={searchStore}>
          <Documents />
        </SearchStoreContext.Provider>
      </ApplicationContext.Provider>
    </MemoryRouter>,
  );
}

describe("Documents surface", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it("renders the loading state", () => {
    const { searchStore, applicationStore } = createSearchStore({ loading: true });

    renderDocuments({ searchStore, applicationStore });

    expect(screen.getByRole("textbox")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Loading documents");
  });

  it("renders the empty state when no journals exist", () => {
    const { searchStore } = createSearchStore();
    const applicationStore = createApplicationStore({
      journals: new JournalsStore(createClient(), [], ""),
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
    expect(screen.getAllByText("/WORK")).toHaveLength(2);
  });

  it("adds an in: token when a journal chip is clicked", async () => {
    const { searchStore, applicationStore } = createSearchStore({
      count: 1,
      docs: [baseDocs[0]],
    });

    renderDocuments({ searchStore, applicationStore });

    fireEvent.click(screen.getByText("/WORK"));

    await waitFor(() => {
      expect(searchStore.searchTokens).toContain("in:work");
    });
  });

  it("renders search error state", async () => {
    const { searchStore, applicationStore } = createSearchStore({
      loading: true,
      searchError: "boom",
    });

    renderDocuments({ searchStore, applicationStore });

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Search failed");
      expect(alert).toHaveTextContent("boom");
    });
  });

  it("invokes pagination behavior and scrolls to top", async () => {
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
