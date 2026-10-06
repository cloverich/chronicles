import { vi } from "vitest";
import {
  PREFERENCES_DEFAULTS,
  type IPreferences,
} from "../electron/preferences-types";
import type { Settings } from "../hooks/useSettings";

/** In-memory Settings; every method is a spy. */
export function fakeSettings(initial: Partial<IPreferences> = {}): Settings {
  let store: IPreferences = { ...PREFERENCES_DEFAULTS, ...initial };
  return {
    get: vi.fn(
      async (key: keyof IPreferences) => store[key],
    ) as Settings["get"],
    all: vi.fn(async () => ({ ...store })),
    setMany: vi.fn(async (partial: Partial<IPreferences>) => {
      store = { ...store, ...partial };
    }),
    location: vi.fn(async () => "/tmp/settings/settings.json"),
  };
}
