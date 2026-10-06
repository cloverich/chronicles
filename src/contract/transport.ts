import {
  NOTES_ERROR_CODES,
  NOTES_OPERATIONS,
  NotesError,
  isNotesError,
  type NotesClient,
  type NotesErrorCode,
} from "./notes";

/**
 * Carrying a NotesClient across a boundary that only preserves an error's
 * message (Electron's contextBridge, a JS ↔ native bridge): the host side
 * encodes the code into the message, the UI side decodes it back into a
 * NotesError.
 */

const PREFIX = /^\[notes:([a-z_]+)\] /;

export function encodeNotesError(err: unknown): Error {
  const code: NotesErrorCode = isNotesError(err) ? err.code : "unavailable";
  const message = err instanceof Error ? err.message : String(err);
  return new Error(`[notes:${code}] ${message}`);
}

export function decodeNotesError(err: unknown): unknown {
  const message = err instanceof Error ? err.message : String(err);
  const m = message.match(PREFIX);
  if (m && (NOTES_ERROR_CODES as readonly string[]).includes(m[1])) {
    return new NotesError(m[1] as NotesErrorCode, message.replace(PREFIX, ""));
  }
  return err;
}

function wrap(
  client: NotesClient,
  mapError: (err: unknown) => unknown,
): NotesClient {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(client) as (keyof NotesClient)[]) {
    const fn = client[key] as (req?: unknown) => Promise<unknown>;
    out[key] = async (req?: unknown) => {
      try {
        return await fn(req);
      } catch (err) {
        throw mapError(err);
      }
    };
  }
  return out as unknown as NotesClient;
}

/**
 * Host side: errors leave as `[notes:<code>] message`. `resolve` is called per
 * operation, so the client may finish initializing after it is exposed.
 */
export function exposeNotesClient(resolve: () => NotesClient): NotesClient {
  const out: Record<string, unknown> = {};
  for (const op of NOTES_OPERATIONS) {
    out[op] = async (req?: unknown) => {
      try {
        return await (resolve()[op] as (r?: unknown) => Promise<unknown>)(req);
      } catch (err) {
        throw encodeNotesError(err);
      }
    };
  }
  return out as unknown as NotesClient;
}

/** UI side: `[notes:<code>]` errors come back as NotesErrors. */
export const hydrateNotesClient = (client: NotesClient) =>
  wrap(client, decodeNotesError);

type AnyFn = (...args: unknown[]) => unknown;

function wrapService<T extends object>(
  service: T,
  mapError: (err: unknown) => unknown,
): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(service)) {
    if (typeof value === "function") {
      out[key] = async (...args: unknown[]) => {
        try {
          return await (value as AnyFn)(...args);
        } catch (err) {
          throw mapError(err);
        }
      };
    } else if (value && typeof value === "object") {
      out[key] = wrapService(value, mapError);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Host side, for the other host services (Settings, Maintenance): every
 * method, including those on nested objects, becomes async and its errors
 * leave as `[notes:<code>] message`.
 */
export const exposeService = <T extends object>(service: T): T =>
  wrapService(service, encodeNotesError);

/** UI side of `exposeService`. */
export const hydrateService = <T extends object>(service: T): T =>
  wrapService(service, decodeNotesError);
