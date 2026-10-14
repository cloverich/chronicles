import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { ApplicationContext } from "../../hooks/useApplicationStore";
import { MaintenanceContext } from "../../hooks/useMaintenance";
import { PlatformContext } from "../../hooks/usePlatform";
import { SettingsContext } from "../../hooks/useSettings";
import { fakeMaintenance, fakePlatform, fakeSettings } from "../../test/fakes";
import Preferences from "./index";

const JOURNALS = [
  { id: "j1", name: "work", archived: false, noteCount: 3 },
  { id: "j2", name: "old", archived: true, noteCount: 1 },
];

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
    journals: {
      journals: JOURNALS,
      active: JOURNALS.filter((j) => !j.archived),
      archived: JOURNALS.filter((j) => j.archived),
      refresh: vi.fn(),
    },
    ...overrides,
  } as any;
}

let platform = fakePlatform();
let maintenance = fakeMaintenance();

function renderPreferences({
  applicationStore = createApplicationStore(),
}: {
  applicationStore?: any;
} = {}) {
  return render(
    <MemoryRouter>
      <MaintenanceContext.Provider value={maintenance}>
        <PlatformContext.Provider value={platform}>
          <SettingsContext.Provider value={fakeSettings()}>
            <ApplicationContext.Provider value={applicationStore}>
              <Preferences isOpen={true} onClose={vi.fn()} />
            </ApplicationContext.Provider>
          </SettingsContext.Provider>
        </PlatformContext.Provider>
      </MaintenanceContext.Provider>
    </MemoryRouter>,
  );
}

describe("Preferences surface", () => {
  beforeEach(() => {
    platform = fakePlatform({
      listAvailableThemes: vi.fn(() => ({
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
      })) as any,
      listInstalledFonts: vi.fn(() => ["Hubot Sans", "Mona Sans"]),
    });
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

  it("exports a single file of the chosen journals, archived ones included", async () => {
    maintenance = fakeMaintenance();
    platform = fakePlatform({
      openDialogSelectDir: vi.fn(async () => ({ value: "/tmp/out" })),
    });
    renderPreferences();

    expect(screen.getByLabelText("Export format")).toHaveValue("archive");
    expect(screen.getByLabelText(/old/)).toBeChecked();
    fireEvent.click(screen.getByLabelText(/old/));
    expect(screen.getByText(/1 of 2 selected/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export notes…" }));
    await waitFor(() => expect(maintenance.exportNotes).toHaveBeenCalled());
    const req = maintenance.exportNotes.mock.calls[0][0] as any;
    expect(req.format).toBe("archive");
    expect(req.journals).toEqual(["j1"]);
    expect(req.dest).toMatch(
      /^\/tmp\/out\/chronicles-export-.*\.chronicles\.zip$/,
    );
  });
});
