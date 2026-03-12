import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  writable: true,
  value: vi.fn(),
});

window.chronicles = {
  getClient: () =>
    ({
      importer: {
        import: vi.fn(),
        clearImportTables: vi.fn(),
      },
      preferences: {
        all: vi.fn(),
        setMultiple: vi.fn(),
        replace: vi.fn(),
        settingsPath: vi.fn(() => "/tmp/settings/settings.json"),
      },
    }) as any,
  openDialogSelectDir: vi.fn(async () => ({ value: undefined })),
  selectThemeFile: vi.fn(async () => ({ value: undefined })),
  importThemeFile: vi.fn(() => ({ success: true, themeName: "Custom" })),
  listAvailableThemes: vi.fn(() => ({ themes: [], overrides: [] })),
  loadThemeByName: vi.fn(),
  listInstalledFonts: vi.fn(() => []),
  getInstalledFontsStylesheetHref: vi.fn(() => ""),
  refreshInstalledFontsCache: vi.fn(() => ({
    changed: false,
    css: "",
    href: "",
  })),
  openPath: vi.fn(),
  setNativeTheme: vi.fn(),
  deleteThemeByName: vi.fn(() => true),
  listHljsThemes: vi.fn(() => []),
  loadHljsThemeCSS: vi.fn(() => ""),
} as any;
