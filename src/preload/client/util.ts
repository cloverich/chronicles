import { Uuid25 } from "uuid25";
import { UUID, uuidv7obj } from "uuidv7";

const MAX_UNIX_TS_MS = 2 ** 48 - 1;

/**
 * Generates a time-sortable chronicles id, optionally incorporating the
 * document / files timestamp so it sorts by creation date
 *
 * When a timestamp is supplied the id is built statelessly: the given
 * millisecond plus fresh random bits. Unlike the library's monotonic
 * generator, backfilled ids never inherit a neighbour's timestamp, so
 * import order cannot shift an id away from the note's createdAt.
 *
 * @param unixTsMs - e.g. from Date.parse or new Date().getTime()
 * @returns A uuid25 formatted string
 * @throws RangeError if unixTsMs is not a finite, non-negative 48-bit value
 */
export function createId(unixTsMs?: number): string {
  const uuid = unixTsMs === undefined ? uuidv7obj() : uuidAt(unixTsMs);
  return Uuid25.fromBytes(uuid.bytes).value;
}

function uuidAt(unixTsMs: number): UUID {
  if (!Number.isFinite(unixTsMs)) {
    throw new RangeError(`createId: invalid timestamp ${unixTsMs}`);
  }
  // sub-ms precision (e.g. fs birthtimeMs) is not representable
  const ts = Math.round(unixTsMs);
  if (ts < 0 || ts > MAX_UNIX_TS_MS) {
    throw new RangeError(`createId: timestamp out of range ${unixTsMs}`);
  }
  const rand = crypto.getRandomValues(new Uint32Array(3));
  return UUID.fromFieldsV7(
    ts,
    rand[0] >>> 20, // 12 bits
    rand[1] >>> 2, // 30 bits
    rand[2], // 32 bits
  );
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
