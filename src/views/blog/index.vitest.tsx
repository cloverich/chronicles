import { describe, expect, it } from "vitest";
import { formatEdited } from ".";

describe("formatEdited", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const row = { id: "a", state: "draft" as const };

  it("uses updatedAt", () => {
    expect(
      formatEdited(
        {
          ...row,
          updatedAt: "2026-10-20T12:00:00Z",
          createdAt: "2024-01-01T00:00:00Z",
        },
        now,
      ),
    ).toBe("2d ago");
  });

  it("falls back to createdAt when updatedAt is missing or unparseable", () => {
    expect(
      formatEdited({ ...row, createdAt: "2026-10-12T12:00:00Z" }, now),
    ).toBe("10d ago");
    expect(
      formatEdited(
        { ...row, updatedAt: "undefined", createdAt: "2026-10-12T12:00:00Z" },
        now,
      ),
    ).toBe("10d ago");
  });

  it("says Unknown with neither", () => {
    expect(formatEdited({ ...row, updatedAt: "nope" }, now)).toBe("Unknown");
  });
});
