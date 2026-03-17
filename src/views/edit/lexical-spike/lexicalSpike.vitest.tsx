import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  lexicalCapabilities,
  slatePlateCapabilities,
} from "./editorArchitecture";
import { MinimalReplacementEditor } from "./minimalReplacementEditor";

describe("lexical migration spike", () => {
  it("documents capability differences from slate/plate", () => {
    expect(slatePlateCapabilities.commandSystem).toBe("transforms");
    expect(lexicalCapabilities.commandSystem).toBe("commands");
    expect(lexicalCapabilities.selectionModel).toBe("key-based");
  });

  it("provides a markdown in/out replacement editor contract", () => {
    const onMarkdownChange = vi.fn();

    render(
      <MinimalReplacementEditor
        initialMarkdown="# Day Log"
        onMarkdownChange={onMarkdownChange}
      />,
    );

    const textarea = screen.getByLabelText("Minimal replacement editor");
    fireEvent.change(textarea, { target: { value: "# Updated" } });

    expect(onMarkdownChange).toHaveBeenCalledWith("# Updated");
  });
});
