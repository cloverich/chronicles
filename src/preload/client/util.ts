import { Uuid25 } from "uuid25";
import { UUID, V7Generator, uuidv7obj } from "uuidv7";

const uuidV7Generator = new V7Generator();

/**
 * Generates a time-sortable chronicles id, optionally incorporating the
 * document / files timestamp so it sorts by creation date
 *
 * @param unixTsMs - e.g. from Date.parse or new Date().getTime()
 * @returns A uuid25 formatted string
 */
export function createId(unixTsMs?: number): string {
  const uuid = unixTsMs
    ? // note: round to eliminate decimal / sub-ms precision which is uneeded and causes
      // an error in the uuidv7 library. Very little thought put into this change.
      uuidV7Generator.generateOrResetCore(Math.round(unixTsMs), 10_000)
    : uuidv7obj();
  const id = Uuid25.fromBytes(uuid.bytes);
  return id.value;
}

/**
 * Convert (legacy) uuidv7 str to uuid25
 */
export function convertId(uuidV7Str: string): string {
  const uuid = UUID.parse(uuidV7Str);
  const id = Uuid25.fromBytes(uuid.bytes);
  return id.value;
}

/**
 * Throw if uuid string is invalid
 */
export function checkId(uuid25Str: string): void {
  Uuid25.parseUuid25(uuid25Str);
}
