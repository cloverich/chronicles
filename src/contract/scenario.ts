import { isNotesError, type NotesClient } from "./notes";

/**
 * Runs a contract fixture (`spec/vectors/contract/*.json`) against any
 * NotesClient. Pure: callers load the JSON and construct the client.
 *
 * Fixture values may use placeholders:
 * - `"$any"` in a response matches any value;
 * - `"$capture:name"` in a response matches any value and remembers it;
 * - `"$ref:name"` in a request or response is replaced by a remembered value;
 * - `{"$base64": "..."}` in a request becomes a Uint8Array;
 * - `"$fill"` as a whole response is replaced with the actual response when
 *   regenerating (UPDATE_VECTORS=1); review the result by hand.
 */

export interface ContractStep {
  note?: string;
  op: keyof NotesClient;
  request?: unknown;
  response?: unknown;
  error?: { code: string };
}

export interface ContractScenario {
  name: string;
  /** Library to seed, by name (see `libraries/`). */
  library: string;
  steps: ContractStep[];
}

export interface ContractFixture {
  description: string;
  scenarios: ContractScenario[];
}

export interface ContractLibrary {
  journals: { id: string; name: string; archivedAt: string | null }[];
  notes: {
    id: string;
    journalId: string;
    title: string | null;
    content: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    frontMatter: Record<string, unknown>;
  }[];
}

export class ContractMismatch extends Error {}

export async function runScenario(
  client: NotesClient,
  scenario: ContractScenario,
  /** Fill mode: return actual responses instead of comparing them. */
  opts: { fill?: boolean } = {},
): Promise<ContractStep[]> {
  const vars = new Map<string, unknown>();
  const filled: ContractStep[] = [];

  for (const [i, step] of scenario.steps.entries()) {
    const where = `${scenario.name} step ${i + 1} (${step.op})`;
    const request = substitute(step.request, vars);
    let actual: unknown;
    let error: unknown;
    try {
      actual = await (client[step.op] as (r: unknown) => Promise<unknown>)(
        request,
      );
    } catch (err) {
      error = err;
    }

    if (opts.fill) {
      const out: ContractStep = { ...step };
      delete out.response;
      delete out.error;
      if (error) {
        if (!isNotesError(error)) throw error;
        out.error = { code: error.code };
      } else if (actual !== undefined) {
        out.response =
          step.response && step.response !== "$fill"
            ? fillTemplate(step.response, actual, vars)
            : actual;
      }
      filled.push(out);
      continue;
    }

    if (step.error) {
      if (!error) {
        throw new ContractMismatch(
          `${where}: expected error ${step.error.code}, got ${JSON.stringify(actual)}`,
        );
      }
      if (!isNotesError(error) || error.code !== step.error.code) {
        throw new ContractMismatch(
          `${where}: expected error ${step.error.code}, got ${String((error as any)?.code ?? error)}: ${(error as Error)?.message}`,
        );
      }
      continue;
    }
    if (error) {
      throw new ContractMismatch(
        `${where}: unexpected error ${(error as any)?.code ?? ""} ${(error as Error)?.message ?? error}`,
      );
    }
    match(step.response, actual, vars, where);
  }
  return filled;
}

function substitute(value: unknown, vars: Map<string, unknown>): unknown {
  if (typeof value === "string" && value.startsWith("$ref:")) {
    const name = value.slice(5);
    if (!vars.has(name)) throw new ContractMismatch(`unbound $ref:${name}`);
    return vars.get(name);
  }
  if (Array.isArray(value)) return value.map((v) => substitute(v, vars));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.$base64 === "string") return fromBase64(obj.$base64);
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, substitute(v, vars)]),
    );
  }
  return value;
}

function match(
  expected: unknown,
  actual: unknown,
  vars: Map<string, unknown>,
  path: string,
): void {
  if (typeof expected === "string") {
    if (expected === "$any") return;
    if (expected.startsWith("$capture:")) {
      vars.set(expected.slice(9), actual);
      return;
    }
    if (expected.startsWith("$ref:")) {
      expected = substitute(expected, vars);
    }
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      throw new ContractMismatch(
        `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
    expected.forEach((e, i) => match(e, actual[i], vars, `${path}[${i}]`));
    return;
  }
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object" || Array.isArray(actual)) {
      throw new ContractMismatch(
        `${path}: expected an object, got ${JSON.stringify(actual)}`,
      );
    }
    const e = expected as Record<string, unknown>;
    const a = actual as Record<string, unknown>;
    const keys = new Set([...Object.keys(e), ...Object.keys(a)]);
    for (const k of keys) {
      if (!(k in e)) {
        throw new ContractMismatch(`${path}.${k}: unexpected key`);
      }
      match(e[k], a[k], vars, `${path}.${k}`);
    }
    return;
  }
  if (expected !== actual) {
    throw new ContractMismatch(
      `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

/** Keep the template's placeholders; take every other value from `actual`. */
function fillTemplate(
  template: unknown,
  actual: unknown,
  vars: Map<string, unknown>,
): unknown {
  if (typeof template === "string" && template.startsWith("$")) {
    if (template.startsWith("$capture:")) vars.set(template.slice(9), actual);
    return template;
  }
  if (Array.isArray(template) && Array.isArray(actual)) {
    return actual.map((a, i) =>
      i < template.length ? fillTemplate(template[i], a, vars) : a,
    );
  }
  if (
    template &&
    actual &&
    typeof template === "object" &&
    typeof actual === "object"
  ) {
    const t = template as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(actual as Record<string, unknown>).map(([k, v]) => [
        k,
        k in t ? fillTemplate(t[k], v, vars) : v,
      ]),
    );
  }
  return actual;
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
