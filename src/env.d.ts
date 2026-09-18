/// <reference types="vite/client" />

declare const __CHRONICLES_BUILD__: {
  version: string;
  commit: string;
  shortCommit: string;
  lastTag: string | null;
  commitsAfterTag: number;
  buildDate: string;
  dirty: boolean;
};
