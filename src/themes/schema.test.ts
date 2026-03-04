import { assert } from "chai";
import { describe, test } from "node:test";
import { validate } from "./schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A minimal valid set of required color tokens (camelCase field names). */
const VALID_COLORS = {
  background: "#1a1a2e",
  foreground: "hsl(222, 47%, 90%)",
  foregroundStrong: "hsl(222, 47%, 98%)",
  muted: "hsl(217, 33%, 17%)",
  mutedForeground: "hsl(215, 20%, 65%)",
  tooltip: "#0f0f23",
  tooltipForeground: "#e0e0ff",
  primary: "hsl(221, 83%, 53%)",
  primaryForeground: "#ffffff",
  secondary: "hsl(217, 33%, 17%)",
  secondaryForeground: "hsl(210, 40%, 98%)",
  accent: "hsl(173, 80%, 40%)",
  accentForeground: "hsl(173, 80%, 10%)",
  accentMuted: "hsl(173, 40%, 30%)",
  link: "hsl(221, 83%, 53%)",
  linkHover: "hsl(221, 83%, 43%)",
  destructive: "hsl(0, 85%, 60%)",
  destructiveForeground: "#ffffff",
  border: "hsl(217, 33%, 25%)",
  ring: "hsl(173, 80%, 40%)",
  tag: "hsl(217, 33%, 20%)",
  tagForeground: "hsl(210, 40%, 98%)",
};

/** Build a minimal valid light-mode theme. */
function makeLight(overrides: Record<string, unknown> = {}) {
  return {
    name: "My Theme",
    version: "1.0.0",
    mode: "light",
    colors: { ...VALID_COLORS },
    ...overrides,
  };
}

/** Build a minimal valid both-mode theme. */
function makeBoth(overrides: Record<string, unknown> = {}) {
  return {
    name: "My Both Theme",
    version: "1.0.0",
    mode: "both",
    colors: {
      light: { ...VALID_COLORS },
      dark: { ...VALID_COLORS },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Top-level structure
// ---------------------------------------------------------------------------

describe("validate — top-level structure", () => {
  test("rejects null", () => {
    const { valid, errors } = validate(null);
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("non-null object")));
  });

  test("rejects a string", () => {
    const { valid } = validate("not a theme");
    assert.isFalse(valid);
  });

  test("rejects an array", () => {
    const { valid } = validate([]);
    assert.isFalse(valid);
  });

  test("rejects empty object", () => {
    const { valid, errors } = validate({});
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("name")));
    assert.isTrue(errors.some((e) => e.includes("version")));
    assert.isTrue(errors.some((e) => e.includes("mode")));
  });
});

// ---------------------------------------------------------------------------
// name
// ---------------------------------------------------------------------------

describe("validate — name", () => {
  test("rejects missing name", () => {
    const theme = makeLight();
    delete (theme as Record<string, unknown>).name;
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("name")));
  });

  test("rejects blank name", () => {
    const { valid, errors } = validate(makeLight({ name: "   " }));
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("name")));
  });

  test("rejects numeric name", () => {
    const { valid, errors } = validate(makeLight({ name: 42 }));
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("name")));
  });

  test("accepts a normal name", () => {
    const { valid } = validate(makeLight({ name: "Neofloss" }));
    assert.isTrue(valid);
  });
});

// ---------------------------------------------------------------------------
// version
// ---------------------------------------------------------------------------

describe("validate — version", () => {
  test("rejects missing version", () => {
    const theme = makeLight();
    delete (theme as Record<string, unknown>).version;
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("version")));
  });

  test("rejects non-semver version", () => {
    const { valid, errors } = validate(makeLight({ version: "v1" }));
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("version")));
  });

  test("accepts semver version", () => {
    const { valid } = validate(makeLight({ version: "2.3.1" }));
    assert.isTrue(valid);
  });

  test("accepts semver with pre-release", () => {
    const { valid } = validate(makeLight({ version: "1.0.0-alpha.1" }));
    assert.isTrue(valid);
  });
});

// ---------------------------------------------------------------------------
// mode
// ---------------------------------------------------------------------------

describe("validate — mode", () => {
  test("rejects invalid mode", () => {
    const { valid, errors } = validate(makeLight({ mode: "auto" }));
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("mode")));
  });

  test("rejects missing mode", () => {
    const theme = makeLight();
    delete (theme as Record<string, unknown>).mode;
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("mode")));
  });

  test("accepts light", () => {
    const { valid } = validate(makeLight({ mode: "light" }));
    assert.isTrue(valid);
  });

  test("accepts dark", () => {
    const { valid } = validate(makeLight({ mode: "dark" }));
    assert.isTrue(valid);
  });

  test("accepts both", () => {
    const { valid } = validate(makeBoth());
    assert.isTrue(valid);
  });
});

// ---------------------------------------------------------------------------
// colors — single mode
// ---------------------------------------------------------------------------

describe("validate — colors (single mode)", () => {
  test("rejects missing colors", () => {
    const theme = makeLight();
    delete (theme as Record<string, unknown>).colors;
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("colors")));
  });

  test("rejects colors as array", () => {
    const { valid, errors } = validate(makeLight({ colors: [] }));
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("colors")));
  });

  test("rejects colors with light/dark sub-keys when mode is light", () => {
    const { valid, errors } = validate(
      makeLight({
        colors: { light: VALID_COLORS, dark: VALID_COLORS },
      }),
    );
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes('"both"')));
  });

  test("reports all missing required tokens", () => {
    const { valid, errors } = validate(makeLight({ colors: {} }));
    assert.isFalse(valid);
    // All 22 required tokens should be reported.
    assert.isTrue(errors.some((e) => e.includes("--background")));
    assert.isTrue(errors.some((e) => e.includes("--foreground-strong")));
    assert.isTrue(errors.some((e) => e.includes("--accent-muted")));
    assert.isTrue(errors.some((e) => e.includes("--link")));
    assert.isTrue(errors.some((e) => e.includes("--ring")));
    assert.isTrue(errors.some((e) => e.includes("--tag-foreground")));
  });

  test("reports missing single required token by CSS name", () => {
    const colors = { ...VALID_COLORS };
    delete (colors as Record<string, unknown>).background;
    const { valid, errors } = validate(makeLight({ colors }));
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("--background")));
  });

  test("reports invalid color value with CSS name", () => {
    const { valid, errors } = validate(
      makeLight({ colors: { ...VALID_COLORS, primary: "notacolor" } }),
    );
    assert.isFalse(valid);
    assert.isTrue(
      errors.some((e) => e.includes("--primary") && e.includes("notacolor")),
    );
  });

  test("accepts hex colors", () => {
    const { valid } = validate(
      makeLight({ colors: { ...VALID_COLORS, background: "#abc" } }),
    );
    assert.isTrue(valid);
  });

  test("accepts 6-digit hex colors", () => {
    const { valid } = validate(
      makeLight({ colors: { ...VALID_COLORS, background: "#1a1a2e" } }),
    );
    assert.isTrue(valid);
  });

  test("accepts hsl() function colors", () => {
    const { valid } = validate(
      makeLight({
        colors: { ...VALID_COLORS, background: "hsl(222, 47%, 11%)" },
      }),
    );
    assert.isTrue(valid);
  });

  test("accepts bare HSL triple", () => {
    const { valid } = validate(
      makeLight({ colors: { ...VALID_COLORS, background: "222 47% 11%" } }),
    );
    assert.isTrue(valid);
  });

  test("accepts valid theme with optional derivable tokens", () => {
    const { valid } = validate(
      makeLight({
        colors: {
          ...VALID_COLORS,
          card: "#1a1a2e",
          input: "222 47% 11%",
          accentSecondary: "hsl(173, 80%, 40%)",
        },
      }),
    );
    assert.isTrue(valid);
  });

  test("reports invalid derivable token value", () => {
    const { valid, errors } = validate(
      makeLight({ colors: { ...VALID_COLORS, card: "not-a-color" } }),
    );
    assert.isFalse(valid);
    assert.isTrue(
      errors.some((e) => e.includes("--card") && e.includes("not-a-color")),
    );
  });

  test("accepts omitted derivable tokens without errors", () => {
    // VALID_COLORS has no derivable fields — should still be valid.
    const { valid, errors } = validate(makeLight());
    assert.isTrue(valid, `Expected valid but got errors: ${errors.join("; ")}`);
  });
});

// ---------------------------------------------------------------------------
// colors — both mode
// ---------------------------------------------------------------------------

describe("validate — colors (mode: both)", () => {
  test("rejects missing colors.light", () => {
    const theme = makeBoth();
    delete (theme.colors as Record<string, unknown>).light;
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("colors.light")));
  });

  test("rejects missing colors.dark", () => {
    const theme = makeBoth();
    delete (theme.colors as Record<string, unknown>).dark;
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(errors.some((e) => e.includes("colors.dark")));
  });

  test("reports errors in colors.light with correct context", () => {
    const theme = makeBoth();
    delete (theme.colors.light as Record<string, unknown>).background;
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(
      errors.some(
        (e) => e.includes("colors.light") && e.includes("--background"),
      ),
    );
  });

  test("reports errors in colors.dark with correct context", () => {
    const theme = makeBoth();
    delete (theme.colors.dark as Record<string, unknown>).primary;
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(
      errors.some((e) => e.includes("colors.dark") && e.includes("--primary")),
    );
  });

  test("detects tokens accidentally placed at colors top-level", () => {
    const theme = makeBoth();
    (theme.colors as Record<string, unknown>).background = "#fff";
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(
      errors.some((e) => e.includes("top level") && e.includes("background")),
    );
  });

  test("accepts valid both-mode theme", () => {
    const { valid, errors } = validate(makeBoth());
    assert.isTrue(valid, `Expected valid but got errors: ${errors.join("; ")}`);
  });

  test("collects errors from both light and dark sub-objects", () => {
    const theme = makeBoth();
    delete (theme.colors.light as Record<string, unknown>).background;
    delete (theme.colors.dark as Record<string, unknown>).foreground;
    const { valid, errors } = validate(theme);
    assert.isFalse(valid);
    assert.isTrue(
      errors.some(
        (e) => e.includes("colors.light") && e.includes("--background"),
      ),
    );
    assert.isTrue(
      errors.some(
        (e) => e.includes("colors.dark") && e.includes("--foreground"),
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Error accumulation
// ---------------------------------------------------------------------------

describe("validate — error accumulation", () => {
  test("returns all errors, not just the first", () => {
    const { valid, errors } = validate({});
    assert.isFalse(valid);
    // Should have multiple errors (name, version, mode at minimum).
    assert.isTrue(errors.length >= 3);
  });

  test("returns valid:true and empty errors for a correct theme", () => {
    const { valid, errors } = validate(makeLight());
    assert.isTrue(valid);
    assert.deepEqual(errors, []);
  });
});
