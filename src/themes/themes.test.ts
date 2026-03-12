import { assert } from "chai";
import { describe, test } from "node:test";
import { BUILTIN_THEMES } from "./builtins";
import { BUNDLED_THEMES } from "./bundled";
import { validate } from "./schema";

describe("BUILTIN_THEMES validation", () => {
  for (const [name, theme] of Object.entries(BUILTIN_THEMES)) {
    test(`theme "${name}" is valid`, () => {
      const { valid, errors } = validate(theme);
      assert.isTrue(
        valid,
        `Theme "${name}" should be valid. Errors: ${errors.join("; ")}`,
      );
    });

    test(`theme "${name}" name matches its key`, () => {
      assert.strictEqual(
        theme.name,
        name,
        `Theme name "${theme.name}" should match BUILTIN_THEMES key "${name}"`,
      );
    });
  }
});

describe("BUNDLED_THEMES validation", () => {
  for (const [name, theme] of Object.entries(BUNDLED_THEMES)) {
    test(`theme "${name}" is valid`, () => {
      const { valid, errors } = validate(theme);
      assert.isTrue(
        valid,
        `Theme "${name}" should be valid. Errors: ${errors.join("; ")}`,
      );
    });

    test(`theme "${name}" name matches its key`, () => {
      assert.strictEqual(
        theme.name,
        name,
        `Theme name "${theme.name}" should match BUNDLED_THEMES key "${name}"`,
      );
    });
  }
});
