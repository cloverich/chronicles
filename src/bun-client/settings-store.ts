import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

/**
 * A minimal JSON-backed settings store that replaces electron-store for the
 * bun-client. Supports dotted-path get/set/delete (e.g. "archivedJournals.foo").
 *
 * The store is synchronous internally but exposes an async-compatible API to
 * match the shape expected by PreferencesClient.
 */
export class SettingsStore<T extends Record<string, any>> {
  private filePath: string;
  private data: Record<string, any>;
  private defaults: Partial<T>;

  constructor(opts: {
    filePath: string;
    defaults?: Partial<T>;
  }) {
    this.filePath = opts.filePath;
    this.defaults = opts.defaults ?? {};
    this.data = this.load();
  }

  get path(): string {
    return this.filePath;
  }

  get store(): T {
    return this.merged() as T;
  }

  get<K extends keyof T>(key: K | string): any {
    const parts = (key as string).split(".");
    let current: any = this.merged();
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = current[part];
    }
    return current;
  }

  set(key: string | Partial<T>, value?: any): void {
    if (typeof key === "object") {
      // set(partialObject) — merge top-level keys
      for (const [k, v] of Object.entries(key)) {
        this.setPath(k, v);
      }
    } else {
      this.setPath(key as string, value);
    }
    this.persist();
  }

  delete<K extends keyof T>(key: K | string): void {
    const parts = (key as string).split(".");
    let current: any = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current == null || typeof current !== "object") return;
      current = current[parts[i]];
    }
    if (current != null && typeof current === "object") {
      delete current[parts[parts.length - 1]];
    }
    this.persist();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private merged(): Record<string, any> {
    return deepMerge(this.defaults as Record<string, any>, this.data);
  }

  private setPath(key: string, value: any): void {
    const parts = key.split(".");
    let current: any = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (current[parts[i]] == null || typeof current[parts[i]] !== "object") {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }

  private load(): Record<string, any> {
    if (!existsSync(this.filePath)) return {};
    try {
      const raw = readFileSync(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
  }
}

// ---------------------------------------------------------------------------
// Utility: deep merge (defaults are overridden by actual values)
// ---------------------------------------------------------------------------

function deepMerge(
  defaults: Record<string, any>,
  overrides: Record<string, any>,
): Record<string, any> {
  const result: Record<string, any> = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof defaults[key] === "object" &&
      defaults[key] !== null &&
      !Array.isArray(defaults[key])
    ) {
      result[key] = deepMerge(defaults[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
