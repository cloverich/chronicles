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
  DROP_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  PASTE_COMMAND,
  TextNode,
  type LexicalEditor,
} from "lexical";
import React from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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

interface NoteSearchResult {
  createdAt: string;
  id: string;
  journal: string;
  title?: string;
}

type NoteSearchQuery = {
  journals: string[];
  limit?: number;
  titles?: string[];
};

type UploadImageBytesFn = (
  arrayBuffer: ArrayBuffer,
  filename?: string,
) => Promise<{ url: string } | string>;

function mockChroniclesClient({
  searchResolver = () => [],
  uploadImageBytes = vi.fn(async (_buffer, filename = "upload.png") => ({
    url: `chronicles://../_attachments/${filename}`,
  })),
}: {
  searchResolver?: (query: NoteSearchQuery) => NoteSearchResult[];
  uploadImageBytes?: UploadImageBytesFn;
} = {}) {
  const searchMock = vi.fn(
    async (query: NoteSearchQuery): Promise<{ data: NoteSearchResult[] }> => ({
      data: searchResolver(query),
    }),
  );

  (window as any).chronicles = {
    getClient() {
      return {
        documents: {
          search: searchMock,
        },
        files: {
          uploadImageBytes,
        },
      };
    },
  };

  return { searchMock, uploadImageBytes };
}

function mockChroniclesSearch(
  resolver: (query: NoteSearchQuery) => NoteSearchResult[],
) {
  return mockChroniclesClient({ searchResolver: resolver }).searchMock;
}

afterEach(() => {
  delete (window as any).chronicles;
});

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

function createImagePasteEvent(file: File): ClipboardEvent {
  const event = new Event("paste", {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent;
  Object.defineProperty(event, "clipboardData", {
    value: {
      files: [file],
      getData(type: string): string {
        return type === "text/plain" ? "" : "";
      },
    } as unknown as Pick<DataTransfer, "files" | "getData">,
  });
  return event;
}

function createDropEvent(file: File): DragEvent {
  const event = new Event("drop", {
    bubbles: true,
    cancelable: true,
  }) as DragEvent;
  Object.defineProperty(event, "dataTransfer", {
    value: {
      files: [file],
      getData(): string {
        return "";
      },
    } as unknown as Pick<DataTransfer, "files" | "getData">,
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

  it("roundtrips image markdown through Lexical", () => {
    const markdown = "![A tidy desk](../_attachments/desk.png)";
    expect(roundtripLexicalMarkdown(markdown)).toBe(markdown);
  });

  it("roundtrips consecutive images through Lexical", () => {
    const markdown = [
      "![one](../_attachments/one.png)",
      "![two](../_attachments/two.png)",
    ].join("\n");
    const roundtripped = roundtripLexicalMarkdown(markdown);
    expect(roundtripped).toContain("![one](../_attachments/one.png)");
    expect(roundtripped).toContain("![two](../_attachments/two.png)");
  });

  it("normalizes chronicles image URLs back to markdown-relative paths", () => {
    const markdown = "![A tidy desk](chronicles://../_attachments/desk.png)";
    expect(roundtripLexicalMarkdown(markdown)).toBe(
      "![A tidy desk](../_attachments/desk.png)",
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

  it("renders markdown images as img elements in the editor DOM", async () => {
    renderEditorWithRoutes(
      "![A tidy desk](chronicles://../_attachments/desk.png)",
    );

    const image = await screen.findByRole("img", { name: "A tidy desk" });
    expect(image.getAttribute("src")).toBe(
      "chronicles://../_attachments/desk.png",
    );
  });

  it("renders relative markdown image URLs using chronicles protocol", async () => {
    renderEditorWithRoutes("![A tidy desk](../_attachments/desk.png)");

    const image = await screen.findByRole("img", { name: "A tidy desk" });
    expect(image.getAttribute("src")).toBe(
      "chronicles://../_attachments/desk.png",
    );
  });

  it("renders consecutive markdown images independently", async () => {
    renderEditorWithRoutes(
      [
        "![one](chronicles://../_attachments/one.png)",
        "![two](chronicles://../_attachments/two.png)",
      ].join("\n"),
    );

    await waitFor(() => {
      expect(screen.getAllByRole("img")).toHaveLength(2);
    });
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

  it("@ trigger shows note-link dropdown and typing filters results", async () => {
    const searchMock = mockChroniclesSearch((query) => {
      const term = query.titles?.[0]?.toLowerCase() ?? "";
      if (term.includes("target")) {
        return [
          {
            createdAt: "2026-03-19",
            id: "target-note",
            journal: "research",
            title: "Target Note",
          },
        ];
      }

      return [
        {
          createdAt: "2026-03-19",
          id: "other-note",
          journal: "research",
          title: "Other Note",
        },
      ];
    });

    let lexicalEditor: LexicalEditor | null = null;
    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown=""
          onMarkdownChange={vi.fn()}
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
    await typeWithLexical(lexicalEditor!, "@target");

    expect(await screen.findByText("Link a Chronicles note")).toBeTruthy();
    expect(await screen.findByText("Target Note")).toBeTruthy();

    await waitFor(() => {
      expect(searchMock).toHaveBeenCalled();
    });
    const latestQuery = searchMock.mock.calls.at(-1)?.[0] as
      | NoteSearchQuery
      | undefined;
    expect(latestQuery?.titles).toEqual(["target"]);
  });

  it("Escape closes note-link dropdown without inserting a link", async () => {
    const onMarkdownChange = vi.fn();
    mockChroniclesSearch(() => [
      {
        createdAt: "2026-03-19",
        id: "target-note",
        journal: "research",
        title: "Target Note",
      },
    ]);

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
    await typeWithLexical(lexicalEditor!, "@target");

    expect(await screen.findByText("Link a Chronicles note")).toBeTruthy();

    await act(async () => {
      lexicalEditor!.dispatchCommand(
        KEY_ESCAPE_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Escape",
          key: "Escape",
        }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("Link a Chronicles note")).toBeNull();
    });
    expect(onMarkdownChange.mock.calls.at(-1)?.[0]).toBe("@target");
  });

  it("shows empty note-link search state when no results are returned", async () => {
    mockChroniclesSearch(() => []);

    let lexicalEditor: LexicalEditor | null = null;
    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown=""
          onMarkdownChange={vi.fn()}
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
    await typeWithLexical(lexicalEditor!, "@zzz");

    expect(await screen.findByText("No matching notes")).toBeTruthy();
  });

  it("inserts a chronicles note link from the dropdown using Enter", async () => {
    const onMarkdownChange = vi.fn();
    mockChroniclesSearch(() => [
      {
        createdAt: "2026-03-19",
        id: "01931c56fc2378079233d986767c519c",
        journal: "research",
        title: "Behavioral Interview Prep",
      },
    ]);

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
    await typeWithLexical(lexicalEditor!, "@beh");
    expect(await screen.findByText("Behavioral Interview Prep")).toBeTruthy();

    await act(async () => {
      lexicalEditor!.dispatchCommand(
        KEY_ENTER_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Enter",
          key: "Enter",
        }),
      );
    });

    await waitFor(() => {
      const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
        | string
        | undefined;
      expect(latestMarkdown).toContain("Behavioral Interview Prep");
      expect(latestMarkdown).toContain(
        "../research/01931c56fc2378079233d986767c519c.md",
      );
    });
    expect(screen.queryByText("Link a Chronicles note")).toBeNull();
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

  it("converts ~~ typing to strikethrough text", async () => {
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
    await typeWithLexical(lexicalEditor!, "~~Beta~~");

    await waitFor(() => {
      expect(editor.querySelector("span.line-through")?.textContent).toBe(
        "Beta",
      );
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toBe("~~Beta~~");
  });

  it("toggles a paragraph into a code block with Cmd+Alt+8", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="const answer = 42;"
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
      selectLexicalText(lexicalEditor!, "const answer = 42;");
      lexicalEditor!.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent("keydown", {
          altKey: true,
          code: "Digit8",
          ctrlKey: true,
          key: "8",
          metaKey: true,
        }),
      );
    });

    await waitFor(() => {
      expect(editor.querySelector("code")).toBeTruthy();
    });

    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toContain("```");
    expect(latestMarkdown).toContain("const answer = 42;");
  });

  it("toggles a code block back to paragraph text with Cmd+Alt+8", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown={["```js", "const answer = 42;", "```"].join("\n")}
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

    await act(async () => {
      fireEvent.focus(screen.getByLabelText("Minimal replacement editor"));
      lexicalEditor!.update(() => {
        $getRoot().selectEnd();
      });
      lexicalEditor!.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent("keydown", {
          altKey: true,
          code: "Digit8",
          ctrlKey: true,
          key: "8",
          metaKey: true,
        }),
      );
    });

    await waitFor(() => {
      const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
        | string
        | undefined;
      expect(latestMarkdown).toContain("const answer = 42;");
      expect(latestMarkdown).not.toContain("```");
    });
  });

  it("shows a code language picker and updates fenced language", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown={["```js", "const answer = 42;", "```"].join("\n")}
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

    await act(async () => {
      fireEvent.focus(screen.getByLabelText("Minimal replacement editor"));
      lexicalEditor!.update(() => {
        $getRoot().selectEnd();
      });
    });

    const languageSelect = (await screen.findByLabelText(
      "Code language",
    )) as HTMLSelectElement;
    const optionValues = Array.from(languageSelect.options).map(
      (option) => option.value,
    );
    const nextLanguage =
      optionValues.find(
        (value) => value !== languageSelect.value && value !== "plain",
      ) ?? optionValues.find((value) => value !== languageSelect.value);
    expect(nextLanguage).toBeDefined();

    fireEvent.change(languageSelect, {
      target: { value: nextLanguage! },
    });

    await waitFor(() => {
      const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
        | string
        | undefined;
      expect(latestMarkdown).toContain("```" + nextLanguage);
    });
  });

  it("roundtrips checklist markdown through Lexical", () => {
    const markdown = ["- [ ] todo", "- [x] done"].join("\n");
    expect(roundtripLexicalMarkdown(markdown)).toBe(markdown);
  });

  it("escapes a list on double Enter and continues in a paragraph", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="- first"
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
        $getRoot().selectEnd();
      });
      lexicalEditor!.dispatchCommand(
        KEY_ENTER_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Enter",
          key: "Enter",
        }),
      );
      lexicalEditor!.dispatchCommand(
        KEY_ENTER_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Enter",
          key: "Enter",
        }),
      );
    });
    await typeWithLexical(lexicalEditor!, "after");

    await waitFor(() => {
      const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
        | string
        | undefined;
      expect(latestMarkdown).toContain("- first");
      expect(latestMarkdown).toContain("\nafter");
      expect(latestMarkdown).not.toContain("- after");
    });
  });

  it("indents and outdents list items with Tab and Shift+Tab", async () => {
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown={["- first", "- second"].join("\n")}
          onMarkdownChange={vi.fn()}
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
      selectLexicalText(lexicalEditor!, "second");
      lexicalEditor!.dispatchCommand(
        KEY_TAB_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Tab",
          key: "Tab",
        }),
      );
    });

    await waitFor(() => {
      expect(editor.querySelector("ul > li > ul > li")?.textContent).toContain(
        "second",
      );
    });

    await act(async () => {
      selectLexicalText(lexicalEditor!, "second");
      lexicalEditor!.dispatchCommand(
        KEY_TAB_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Tab",
          key: "Tab",
          shiftKey: true,
        }),
      );
    });

    await waitFor(() => {
      expect(editor.querySelector("ul > li > ul > li")).toBeNull();
    });
  });

  it("Cmd+Enter exits code blocks to a paragraph", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown={["```js", "const answer = 42;", "```"].join("\n")}
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
        $getRoot().selectEnd();
      });
      lexicalEditor!.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Enter",
          ctrlKey: true,
          key: "Enter",
          metaKey: true,
        }),
      );
    });
    await typeWithLexical(lexicalEditor!, "After code");

    await waitFor(() => {
      const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
        | string
        | undefined;
      expect(latestMarkdown).toContain("After code");

      const afterCodeIndex = latestMarkdown?.indexOf("After code") ?? -1;
      const closingFenceIndex = latestMarkdown?.lastIndexOf("```") ?? -1;
      expect(afterCodeIndex).toBeGreaterThan(closingFenceIndex);
    });
  });

  it("Cmd+Enter exits blockquotes to a paragraph", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown="> quoted"
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
        $getRoot().selectEnd();
      });
      lexicalEditor!.dispatchCommand(
        KEY_DOWN_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Enter",
          ctrlKey: true,
          key: "Enter",
          metaKey: true,
        }),
      );
    });
    await typeWithLexical(lexicalEditor!, "After quote");

    await waitFor(() => {
      const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
        | string
        | undefined;
      expect(latestMarkdown).toContain("After quote");
      expect(latestMarkdown).toContain("\nAfter quote");
      expect(latestMarkdown).not.toContain("> After quote");
    });
  });

  it("Enter on an empty trailing code line exits to a paragraph", async () => {
    const onMarkdownChange = vi.fn();
    let lexicalEditor: LexicalEditor | null = null;

    render(
      <MemoryRouter>
        <LexicalBasedEditor
          initialMarkdown={["```js", "const answer = 42;", "```"].join("\n")}
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
        $getRoot().selectEnd();
      });
      lexicalEditor!.dispatchCommand(
        KEY_ENTER_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Enter",
          key: "Enter",
        }),
      );
      lexicalEditor!.dispatchCommand(
        KEY_ENTER_COMMAND,
        new KeyboardEvent("keydown", {
          code: "Enter",
          key: "Enter",
        }),
      );
    });
    await typeWithLexical(lexicalEditor!, "After trailing line");

    await waitFor(() => {
      const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
        | string
        | undefined;
      expect(latestMarkdown).toContain("After trailing line");

      const afterIndex = latestMarkdown?.indexOf("After trailing line") ?? -1;
      const closeFenceIndex = latestMarkdown?.lastIndexOf("```") ?? -1;
      expect(afterIndex).toBeGreaterThan(closeFenceIndex);
    });
  });

  it("uploads dropped image files and inserts image markdown", async () => {
    const onMarkdownChange = vi.fn();
    const uploadImageBytes = vi.fn(async (_buffer: ArrayBuffer) => ({
      url: "chronicles://../_attachments/dropped.png",
    }));
    mockChroniclesClient({ uploadImageBytes });
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
    const file = new File(["png-bytes"], "dropped.png", { type: "image/png" });
    await act(async () => {
      fireEvent.focus(editor);
      lexicalEditor!.update(() => {
        $getRoot().selectStart();
      });
      lexicalEditor!.dispatchCommand(DROP_COMMAND, createDropEvent(file));
    });

    await waitFor(() => {
      expect(uploadImageBytes).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        "dropped.png",
      );
    });

    const image = await screen.findByRole("img", { name: "dropped.png" });
    expect(image.getAttribute("src")).toBe(
      "chronicles://../_attachments/dropped.png",
    );

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });
    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toContain(
      "![dropped.png](../_attachments/dropped.png)",
    );
  });

  it("uploads pasted image files and inserts image markdown", async () => {
    const onMarkdownChange = vi.fn();
    const uploadImageBytes = vi.fn(async (_buffer: ArrayBuffer) => ({
      url: "chronicles://../_attachments/pasted.png",
    }));
    mockChroniclesClient({ uploadImageBytes });
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
    const file = new File(["png-bytes"], "pasted.png", { type: "image/png" });
    await act(async () => {
      fireEvent.focus(editor);
      lexicalEditor!.update(() => {
        $getRoot().selectStart();
      });
      lexicalEditor!.dispatchCommand(
        PASTE_COMMAND,
        createImagePasteEvent(file),
      );
    });

    await waitFor(() => {
      expect(uploadImageBytes).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        "pasted.png",
      );
    });

    const image = await screen.findByRole("img", { name: "pasted.png" });
    expect(image.getAttribute("src")).toBe(
      "chronicles://../_attachments/pasted.png",
    );

    await waitFor(() => {
      expect(onMarkdownChange).toHaveBeenCalled();
    });
    const latestMarkdown = onMarkdownChange.mock.calls.at(-1)?.[0] as
      | string
      | undefined;
    expect(latestMarkdown).toContain(
      "![pasted.png](../_attachments/pasted.png)",
    );
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
