import { render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LexicalBasedEditor } from "./LexicalBasedEditor";
import {
  renderContractFixtures,
  type RenderContractFixture,
} from "./renderContracts.fixtures";

function renderLexicalFixture(markdown: string): HTMLElement {
  render(
    <MemoryRouter>
      <LexicalBasedEditor
        initialMarkdown={markdown}
        onMarkdownChange={vi.fn()}
      />
    </MemoryRouter>,
  );

  return screen.getByLabelText("Minimal replacement editor");
}

async function assertRenderContract(
  fixture: RenderContractFixture,
): Promise<void> {
  const editor = renderLexicalFixture(fixture.markdown);

  await waitFor(() => {
    for (const expectedLink of fixture.expectedLinks) {
      expect(
        within(editor).getByRole("link", {
          name: expectedLink.name,
        }),
      ).toBeInTheDocument();
    }
  });

  for (const expectedLink of fixture.expectedLinks) {
    const link = within(editor).getByRole("link", { name: expectedLink.name });
    expect(link.getAttribute("href")).toBe(expectedLink.href);
    expect(link.textContent).toBe(expectedLink.name);

    if (expectedLink.noteLink) {
      expect(link.getAttribute("data-chronicles-note-link")).toBe("true");
    }
  }

  if (typeof fixture.expectedLinkCount === "number") {
    expect(editor.querySelectorAll("a")).toHaveLength(
      fixture.expectedLinkCount,
    );
  }

  const strongTexts = Array.from(editor.querySelectorAll("strong")).map(
    (node) => (node.textContent ?? "").trim(),
  );
  for (const expectedStrongText of fixture.expectedStrongTexts ?? []) {
    expect(strongTexts).toContain(expectedStrongText);
  }

  const italicTexts = Array.from(editor.querySelectorAll("em")).map((node) =>
    (node.textContent ?? "").trim(),
  );
  for (const expectedItalicText of fixture.expectedItalicTexts ?? []) {
    expect(italicTexts).toContain(expectedItalicText);
  }

  const codeTexts = Array.from(editor.querySelectorAll("code")).map((node) =>
    (node.textContent ?? "").trim(),
  );
  for (const expectedCodeText of fixture.expectedInlineCodeTexts ?? []) {
    expect(codeTexts).toContain(expectedCodeText);
  }

  if (fixture.disallowFormattedNodesInsideLinks) {
    expect(editor.querySelector("a strong, a em, a code")).toBeNull();
  }

  for (const selector of fixture.requiredSelectors ?? []) {
    expect(editor.querySelector(selector)).toBeTruthy();
  }

  for (const fragment of fixture.requiredHtmlFragments ?? []) {
    expect(editor.innerHTML).toContain(fragment);
  }

  for (const fragment of fixture.forbiddenTextFragments ?? []) {
    expect(editor.textContent ?? "").not.toContain(fragment);
  }

  for (const fragment of fixture.requiredTextFragments ?? []) {
    expect(editor.textContent ?? "").toContain(fragment);
  }
}

describe("lexical render contracts", () => {
  for (const fixture of renderContractFixtures) {
    it(`renders fixture: ${fixture.id}`, async () => {
      await assertRenderContract(fixture);
    });
  }
});
