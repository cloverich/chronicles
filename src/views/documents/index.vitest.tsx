import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { JournalsStore } from "../../hooks/stores/journals";
import { ApplicationContext } from "../../hooks/useApplicationStore";
import { SearchStoreContext } from "./SearchStore";
import Documents from "./index";

function createClient() {
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

function createSearchStore(overrides: Record<string, unknown> = {}) {
  return {
    docs: [],
    loading: false,
    error: null,
    count: 0,
    hasNext: false,
    hasPrev: false,
    searchTokens: [],
    addToken: vi.fn(),
    removeToken: vi.fn(),
    setSearch: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    ...overrides,
  } as any;
}

function renderDocuments({
  applicationStore = createApplicationStore(),
  searchStore = createSearchStore(),
}: {
  applicationStore?: any;
  searchStore?: any;
} = {}) {
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
  it("renders the loading state", () => {
    renderDocuments({
      searchStore: createSearchStore({ loading: true }),
    });

    expect(screen.getByText("Loading documents")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search notes")).toBeInTheDocument();
  });

  it("renders the empty state when no journals exist", () => {
    renderDocuments({
      applicationStore: createApplicationStore({
        journals: new JournalsStore(createClient(), [], ""),
      }),
    });

    expect(screen.getByText("No journals added")).toBeInTheDocument();
    expect(screen.getByText(/create a new journal/i)).toBeInTheDocument();
  });

  it("renders search results through the real layout and item components", () => {
    renderDocuments({
      searchStore: createSearchStore({
        count: 2,
        docs: [
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
        ],
      }),
    });

    expect(screen.getByText(/\[2 DOCS FOUND\]/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search notes")).toBeInTheDocument();
    expect(screen.getByText("First note")).toBeInTheDocument();
    expect(screen.getByText("Second note")).toBeInTheDocument();
    expect(screen.getAllByText("/WORK")).toHaveLength(2);
  });
});
