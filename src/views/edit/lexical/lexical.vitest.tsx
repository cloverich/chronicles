import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  $getRoot,
  $nodesOfType,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  PASTE_COMMAND,
  TextNode,
  type LexicalEditor,
} from "lexical";
import React from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LexicalBasedEditor } from "./LexicalBasedEditor";
import {
  lexicalCapabilities,
  slatePlateCapabilities,
} from "./editorArchitecture";
import { roundtripLexicalMarkdown } from "./lexicalMarkdown";

if (typeof globalThis.DragEvent === "undefined") {
  class DragEventPolyfill extends Event {}
  (globalThis as any).DragEvent = DragEventPolyfill;
}

if (typeof globalThis.ClipboardEvent === "undefined") {
  class ClipboardEventPolyfill extends Event {
    clipboardData: DataTransfer | null = null;
  }
  (globalThis as any).ClipboardEvent = ClipboardEventPolyfill;
}

function RouterLocationProbe(): JSX.Element {
  const location = useLocation();
  return <div data-testid="router-location">{location.pathname}</div>;
}

function renderEditorWithRoutes(
  initialMarkdown: string,
  onMarkdownChange = vi.fn(),
) {
  return render(
    <MemoryRouter initialEntries={["/documents/edit/source-note"]}>
      <Routes>
        <Route
          path="/documents/edit/:noteId"
          element={
            <>
              <RouterLocationProbe />
              <LexicalBasedEditor
                initialMarkdown={initialMarkdown}
                onMarkdownChange={onMarkdownChange}
              />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

function selectLexicalText(editor: LexicalEditor, text: string): void {
  editor.update(
    () => {
      const target = $nodesOfType(TextNode).find((node) =>
        node.getTextContent().includes(text),
      );
      if (!target) {
        throw new Error(`Unable to find lexical text containing "${text}"`);
      }

      const content = target.getTextContent();
      const start = content.indexOf(text);
      if (start === -1) {
        throw new Error(`Unable to find "${text}" in lexical text node`);
      }

      target.select(start, start + text.length);
    },
    { discrete: true },
  );
}

function createPasteEvent(plainText: string): ClipboardEvent {
  const event = new Event("paste", {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", {
    value: {
      getData(type: string): string {
        return type === "text/plain" ? plainText : "";
      },
    } as Pick<DataTransfer, "getData">,
  });
  return event;
}

async function typeWithLexical(
  editor: LexicalEditor,
  text: string,
): Promise<void> {
  for (const char of text) {
    await act(async () => {
      editor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, char);
    });
  }
}

describe("lexical migration spike", () => {
  it("documents capability differences from slate/plate", () => {
    expect(slatePlateCapabilities.commandSystem).toBe("transforms");
    expect(lexicalCapabilities.commandSystem).toBe("commands");
    expect(lexicalCapabilities.selectionModel).toBe("key-based");
  });

  it("roundtrips baseline markdown through Lexical", () => {
    expect(
      roundtripLexicalMarkdown(
        ["# Day Log", "", "- one", "- two", "", "> quote", "", "`code`"].join(
          "\n",
        ),
      ),
    ).toBe(
      ["# Day Log", "", "- one", "- two", "", "> quote", "", "`code`"].join(
        "\n",
      ),
    );
  });

  it("roundtrips code fences with language tags through Lexical", () => {
    const markdown = ["```typescript", "const answer = 42;", "```"].join("\n");
    expect(roundtripLexicalMarkdown(markdown)).toBe(markdown);
  });

  it("roundtrips chronicles note links through Lexical", () => {
    expect(
      roundtripLexicalMarkdown(
        "[Behavioral Interview Prep](../research/01931c56fc2378079233d986767c519c.md)",
      ),
    ).toBe(
      "[Behavioral Interview Prep](../research/01931c56fc2378079233d986767c519c.md)",
    );
  });

  it("roundtrips regular links through Lexical", () => {
    expect(roundtripLexicalMarkdown("[Like this](https://foo.com)")).toBe(
      "[Like this](https://foo.com)",
    );
  });

  it("normalizes quoted-url links to standard markdown links", () => {
    expect(roundtripLexicalMarkdown('[Like this]("https://foo.com")')).toBe(
      "[Like this](https://foo.com)",
    );
  });

  it("renders the lexical replacement seam", () => {
    const onMarkdownChange = vi.fn();

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="# Day Log"
          onMarkdownChange={onMarkdownChange}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText("Minimal replacement editor")).toBeTruthy();
    expect(screen.getByText("Day Log")).toBeTruthy();
  });

  it("renders regular links as anchors in the editor DOM", async () => {
    renderEditorWithRoutes("[Like this](https://foo.com)");

    const link = await screen.findByRole("link", { name: "Like this" });
    expect(link.getAttribute("href")).toBe("https://foo.com");
    expect(link.className).toContain("cursor-pointer");
  });

  it("renders quoted-url links as anchors in the editor DOM", async () => {
    renderEditorWithRoutes('[Like this]("https://foo.com")');

    const link = await screen.findByRole("link", { name: "Like this" });
    expect(link.getAttribute("href")).toBe("https://foo.com");
  });

  it("navigates directly when clicking a chronicles note link", async () => {
    renderEditorWithRoutes(
      "[Target note](../research/01931c56fc2378079233d986767c519c.md)",
    );

    const noteLink = await screen.findByRole("link", { name: "Target note" });
    fireEvent.click(noteLink);

    await waitFor(() => {
      expect(screen.getByTestId("router-location").textContent).toBe(
        "/documents/edit/01931c56fc2378079233d986767c519c",
      );
    });
  });

  it("opens a link toolbar when clicking a regular link", async () => {
    renderEditorWithRoutes("[Like this](https://foo.com)");

    const link = await screen.findByRole("link", { name: "Like this" });
    fireEvent.click(link);

    expect(
      await screen.findByRole("button", { name: "Edit link" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open link" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unlink" })).toBeTruthy();
  });

  it("positions the regular-link toolbar from the clicked link bounds", async () => {
    renderEditorWithRoutes("[Like this](https://foo.com)");

    const link = await screen.findByRole("link", { name: "Like this" });
    const rectSpy = vi.spyOn(link, "getBoundingClientRect").mockReturnValue({
      bottom: 220,
      height: 20,
      left: 100,
      right: 140,
      toJSON: () => ({}),
      top: 200,
      width: 40,
      x: 100,
      y: 200,
    } as DOMRect);

    fireEvent.click(link);

    await waitFor(() => {
      const toolbar = screen.getByTestId("lexical-link-toolbar");
      expect((toolbar as HTMLElement).style.position).toBe("fixed");
      expect((toolbar as HTMLElement).style.left).toBe("100px");
      expect((toolbar as HTMLElement).style.top).toBe("228px");
    });

    rectSpy.mockRestore();
  });

  it("uses project button hover styles in the regular-link toolbar", async () => {
    renderEditorWithRoutes("[Like this](https://foo.com)");

    fireEvent.click(await screen.findByRole("link", { name: "Like this" }));
    const editButton = await screen.findByRole("button", { name: "Edit link" });
    expect(editButton.className).toContain("hover:bg-accent");

    fireEvent.click(editButton);
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton.className).toContain("hover:bg-accent");
  });

  it("closes the regular-link toolbar when clicking outside while editing", async () => {
    renderEditorWithRoutes("[Like this](https://foo.com)");

    fireEvent.click(await screen.findByRole("link", { name: "Like this" }));
    fireEvent.click(await screen.findByRole("button", { name: "Edit link" }));
    expect(screen.getByLabelText("Link URL")).toBeTruthy();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByTestId("lexical-link-toolbar")).toBeNull();
    });
  });

  it("opens regular links from the toolbar", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderEditorWithRoutes("[Like this](https://foo.com)");

    const link = await screen.findByRole("link", { name: "Like this" });
    fireEvent.click(link);
    fireEvent.click(await screen.findByRole("button", { name: "Open link" }));

    expect(openSpy).toHaveBeenCalledWith("https://foo.com", "_blank");
    openSpy.mockRestore();
  });

  it("edits a regular link label and href through the toolbar", async () => {
    const onMarkdownChange = vi.fn();
    renderEditorWithRoutes("[Like this](https://foo.com)", onMarkdownChange);

    const link = await screen.findByRole("link", { name: "Like this" });
    fireEvent.click(link);
    fireEvent.click(await screen.findByRole("button", { name: "Edit link" }));

    fireEvent.change(screen.getByLabelText("Link URL"), {
      target: { value: "https://example.com/next" },
    });
    fireEvent.change(screen.getByLabelText("Link text"), {
      target: { value: "Updated label" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const updatedLink = screen.getByRole("link", { name: "Updated label" });
      expect(updatedLink.getAttribute("href")).toBe("https://example.com/next");
    });

    await waitFor(() => {
      const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
        | string
        | undefined;
      expect(latestMarkdown).toBe("[Updated label](https://example.com/next)");
    });
  });

  it("unlinks a regular link through the toolbar", async () => {
    const onMarkdownChange = vi.fn();
    renderEditorWithRoutes("[Like this](https://foo.com)", onMarkdownChange);

    const link = await screen.findByRole("link", { name: "Like this" });
    fireEvent.click(link);
    fireEvent.click(await screen.findByRole("button", { name: "Unlink" }));

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Like this" })).toBeNull();
      expect(screen.getByText("Like this")).toBeTruthy();
    });

    await waitFor(() => {
      const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
        | string
        | undefined;
      expect(latestMarkdown).toBe("Like this");
    });
  });

  it("does not crash when clicking in the editor surface", () => {
    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="# Click Test"
          onMarkdownChange={vi.fn()}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByLabelText("Minimal replacement editor"));

    expect(screen.getByLabelText("Minimal replacement editor")).toBeTruthy();
    expect(screen.queryByText("Unhandled Error")).toBeNull();
  });

  it("applies Cmd+B only to the selected text", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="Alpha Beta"
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      selectLexicalText(lexicalEditor!, "Alpha");

      lexicalEditor!.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent("keydown", {
          code: "KeyB",
          ctrlKey: true,
          key: "b",
          metaKey: true,
        }),
      );
    });

    await waitFor(() => {
      expect(editor.querySelector("strong")?.textContent).toBe("Alpha");
    });

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toContain("**Alpha**");
    expect(latestMarkdown).toContain("Beta");
    expect(latestMarkdown).not.toContain("**Alpha Beta**");
  });

  it("applies Cmd+I only to the selected text", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="Alpha Beta"
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      selectLexicalText(lexicalEditor!, "Beta");

      lexicalEditor!.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent("keydown", {
          code: "KeyI",
          ctrlKey: true,
          key: "i",
          metaKey: true,
        }),
      );
    });

    await waitFor(() => {
      expect(editor.querySelector("em")?.textContent).toBe("Beta");
    });

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toContain("Alpha");
    expect(latestMarkdown).toMatch(/(\*Beta\*|_Beta_)/);
    expect(latestMarkdown).not.toMatch(/(\*Alpha Beta\*|_Alpha Beta_)/);
  });

  it("applies Cmd+E only to the selected text", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="Alpha Beta"
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      selectLexicalText(lexicalEditor!, "Alpha");

      lexicalEditor!.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent("keydown", {
          code: "KeyE",
          ctrlKey: true,
          key: "e",
          metaKey: true,
        }),
      );
    });

    await waitFor(() => {
      expect(editor.querySelector("code")?.textContent).toBe("Alpha");
    });

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toContain("`Alpha`");
    expect(latestMarkdown).toContain("Beta");
    expect(latestMarkdown).not.toContain("`Alpha Beta`");
  });

  it("applies Cmd+Shift+S only to the selected text", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="Alpha Beta"
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      selectLexicalText(lexicalEditor!, "Beta");

      lexicalEditor!.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent("keydown", {
          code: "KeyS",
          ctrlKey: true,
          key: "s",
          metaKey: true,
          shiftKey: true,
        }),
      );
    });

    await waitFor(() => {
      expect(editor.querySelector("span.line-through")?.textContent).toBe(
        "Beta",
      );
    });

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toContain("Alpha");
    expect(latestMarkdown).toContain("~~Beta~~");
    expect(latestMarkdown).not.toContain("~~Alpha Beta~~");
  });

  it("applies Cmd+U only to the selected text", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="Alpha Beta"
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      selectLexicalText(lexicalEditor!, "Alpha");

      lexicalEditor!.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent("keydown", {
          code: "KeyU",
          ctrlKey: true,
          key: "u",
          metaKey: true,
        }),
      );
    });

    await waitFor(() => {
      expect(editor.querySelector("span.underline")?.textContent).toBe("Alpha");
    });

    expect(onMarkdownChange).not.toHaveBeenCalled();

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toBeUndefined();
  });

  it("converts single-backtick typing to inline code", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown=""
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      lexicalEditor!.update(() => {
        $getRoot().selectStart();
      });
    });
    await typeWithLexical(lexicalEditor!, "`Alpha`");

    await waitFor(() => {
      expect(editor.querySelector("code")?.textContent).toBe("Alpha");
    });

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toBe("`Alpha`");
  });

  it("converts fenced markdown typing to a highlighted code block", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown=""
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      lexicalEditor!.update(() => {
        $getRoot().selectStart();
      });
    });
    await typeWithLexical(lexicalEditor!, "```js");
    await act(async () => {
      lexicalEditor!.dispatchCommand(
        KEY_ENTER_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Enter",
          key: "Enter",
        }),
      );
    });
    await typeWithLexical(lexicalEditor!, "const answer = 42;");

    await waitFor(() => {
      const codeBlock = editor.querySelector("code[data-language='js']");
      expect(codeBlock).toBeTruthy();
      expect(codeBlock?.getAttribute("data-highlight-language")).toBe("js");
    });

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toContain("```js");
    expect(latestMarkdown).toContain("const answer = 42;");
  });

  it("converts ## typing at line start to an h2 block", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown=""
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      lexicalEditor!.update(() => {
        $getRoot().selectStart();
      });
    });
    await typeWithLexical(lexicalEditor!, "## Heading");

    await waitFor(() => {
      expect(editor.querySelector("h2")?.textContent).toBe("Heading");
    });

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toBe("## Heading");
  });

  it("converts > typing at line start to a blockquote", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown=""
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      lexicalEditor!.update(() => {
        $getRoot().selectStart();
      });
    });
    await typeWithLexical(lexicalEditor!, "> Quoted");

    await waitFor(() => {
      expect(editor.querySelector("blockquote")?.textContent).toContain(
        "Quoted",
      );
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toBe("> Quoted");
  });

  it("converts - typing at line start to an unordered list", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown=""
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      lexicalEditor!.update(() => {
        $getRoot().selectStart();
      });
    });
    await typeWithLexical(lexicalEditor!, "- first");

    await waitFor(() => {
      expect(editor.querySelector("ul li")?.textContent).toContain("first");
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toBe("- first");
  });

  it("converts 1. typing at line start to an ordered list", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown=""
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      lexicalEditor!.update(() => {
        $getRoot().selectStart();
      });
    });
    await typeWithLexical(lexicalEditor!, "1. first");

    await waitFor(() => {
      expect(editor.querySelector("ol li")?.textContent).toContain("first");
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toBe("1. first");
  });

  it("creates a link from selected text when pasting a URL", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="Alpha Beta"
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      selectLexicalText(lexicalEditor!, "Alpha");
      lexicalEditor!.dispatchCommand(
        PASTE_COMMAND,
        createPasteEvent("https://chronicles.app/docs"),
      );
    });

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Alpha" });
      expect(link.getAttribute("href")).toBe("https://chronicles.app/docs");
    });

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toContain("[Alpha](https://chronicles.app/docs)");
    expect(latestMarkdown).toContain("Beta");
    expect(latestMarkdown).not.toContain(
      "[Alpha Beta](https://chronicles.app/docs)",
    );
  });

  it("does not create a link from paste when clipboard text is not a URL", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="Alpha Beta"
          onMarkdownChange={onMarkdownChange}
          onEditorReady={(editor) => {
            lexicalEditor = editor;
          }}
        />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(lexicalEditor).not.toBeNull();
    });

    const editor = screen.getByLabelText("Minimal replacement editor");
    await act(async () => {
      fireEvent.focus(editor);
      selectLexicalText(lexicalEditor!, "Alpha");
      lexicalEditor!.dispatchCommand(
        PASTE_COMMAND,
        createPasteEvent("not a link"),
      );
    });

    expect(screen.queryByRole("link", { name: "Alpha" })).toBeNull();
    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });
    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toBe("not a link Beta");
    expect(latestMarkdown).not.toContain("](");
  });
});
