import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { ApplicationContext } from "../../hooks/useApplicationStore";
import { ClientContext } from "../../hooks/useClient";
import Preferences from "./index";

function createClient() {
  return {
    importer: {
      import: vi.fn(),
      clearImportTables: vi.fn(),
    },
    preferences: {
      settingsPath: vi.fn(() => "/tmp/settings/settings.json"),
      setMultiple: vi.fn(),
      replace: vi.fn(),
      all: vi.fn(),
    },
    documents: {
      rebuildDerived: vi.fn(),
    },
  } as any;
}

function createApplicationStore(overrides: Record<string, unknown> = {}) {
  return {
    preferences: {
      darkMode: "system",
      themeLightName: "System Light",
      themeDarkName: "System Dark",
      codeThemeLight: "github",
      codeThemeDark: "github-dark",
      fonts: {},
      fontSizes: {},
      maxWidth: {},
      databaseUrl: "/tmp/chronicles.sqlite",
      notesDir: "/tmp/notes",
      settingsDir: "/tmp/settings",
      saveImmediate: vi.fn(),
    },
    maintenance: {
      isRepairing: false,
      repair: vi.fn(),
    },
    ...overrides,
  } as any;
}

function renderPreferences({
  client = createClient(),
  applicationStore = createApplicationStore(),
}: {
  client?: any;
  applicationStore?: any;
} = {}) {
  return render(
    <MemoryRouter>
      <ClientContext.Provider value={client}>
        <ApplicationContext.Provider value={applicationStore}>
          <Preferences isOpen={true} onClose={vi.fn()} />
        </ApplicationContext.Provider>
      </ClientContext.Provider>
    </MemoryRouter>,
  );
}

describe("Preferences surface", () => {
  beforeEach(() => {
    window.chronicles.listAvailableThemes = vi.fn(() => ({
      themes: [
        {
          name: "System Light",
          builtin: true,
          bundled: true,
          mode: "light",
        },
        {
          name: "System Dark",
          builtin: true,
          bundled: true,
          mode: "dark",
        },
        {
          name: "Solarized",
          builtin: false,
          bundled: false,
          mode: "light",
        },
      ],
      overrides: [],
    })) as any;
    window.chronicles.listInstalledFonts = vi.fn(() => [
      "Hubot Sans",
      "Mona Sans",
    ]) as any;
  });

  it("renders the settings sections when opened", () => {
    renderPreferences();

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Appearance" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fonts" })).toBeInTheDocument();
    expect(screen.getByText("Notes directory")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Import directory" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View changelog" }),
    ).toBeInTheDocument();
  });
});
