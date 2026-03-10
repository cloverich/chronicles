export interface ISettingsStore<T extends Record<string, any>> {
  get<K extends keyof T>(key: K): T[K];
  get(key: string): unknown;
  set<K extends keyof T>(key: K, value: T[K]): void;
  set(key: string, value: unknown): void;
  set(obj: Partial<T>): void;
  delete<K extends keyof T>(key: K): void;
  readonly path: string;
  readonly store: T;
}
