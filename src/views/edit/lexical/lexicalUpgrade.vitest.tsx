import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  $getRoot,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  CUT_COMMAND,
  KEY_BACKSPACE_COMMAND,
  PASTE_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  createEditor,
  type LexicalEditor,
} from "lexical";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { createMemoryNotesClient } from "../../../contract/memory";
import { NotesContext } from "../../../hooks/useNotes";
import { EditableDocument } from "../EditableDocument";
import { LexicalBasedEditor } from "./LexicalBasedEditor";
import {
  $exportMarkdownFromLexical,
  $loadMarkdownIntoLexical,
  lexicalNodes,
  roundtripLexicalMarkdown,
} from "./lexicalMarkdown";

async function mountEditor(markdown: string, onChange = vi.fn()) {
  let editor!: LexicalEditor;
  const view = render(
    <MemoryRouter>
      <LexicalBasedEditor
        initialMarkdown={markdown}
        onMarkdownChange={onChange}
        onEditorReady={(ready) => {
          editor = ready;
        }}
      />
    </MemoryRouter>,
  );
  await waitFor(() => expect(editor).toBeDefined());
  return { editor, view, onChange };
}

function markdownOf(editor: LexicalEditor) {
  return editor.getEditorState().read($exportMarkdownFromLexical);
}

function clipboardEvent(
  type: string,
  values: Map<string, string>,
  files: File[] = [],
) {
  if (typeof ClipboardEvent === "undefined") {
    vi.stubGlobal(
      "ClipboardEvent",
      class ClipboardEventPolyfill extends Event {},
    );
  }
  if (typeof DragEvent === "undefined") {
    vi.stubGlobal("DragEvent", class DragEventPolyfill extends Event {});
  }
  const event = new ClipboardEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: {
      files,
      types: [...values.keys()],
      getData: (key: string) => values.get(key) ?? "",
      setData: (key: string, value: string) => values.set(key, value),
    },
  });
  return event;
}

const languageCases = [
  '```custom-language title="demo"\nfirst\nsecond\n```',
  "```plain\nfirst\nsecond\n```",
  "```\nfirst\nsecond\n```",
];

describe("Lexical upgrade compatibility", () => {
  it.each(languageCases)(
    "preserves code language and metadata: %s",
    (markdown) => {
      expect(roundtripLexicalMarkdown(markdown)).toBe(markdown);
    },
  );

  it("preserves mixed list types and formatted link boundaries", () => {
    const markdown =
      "- parent\n    1. ordered\n    2. second\n        - [x] checked\n\n**before [web](https://example.com) after** and *before [note](chronicles://note/03awvyp9xobkv9t1jmmtiz0bp) after*";
    const normalized =
      "- parent\n    1. ordered\n    2. second\n        - [x] checked\n\n**before** [**web**](https://example.com) **after** and *before* [*note*](chronicles://note/03awvyp9xobkv9t1jmmtiz0bp) *after*";
    expect(roundtripLexicalMarkdown(markdown)).toBe(normalized);
    expect(roundtripLexicalMarkdown(normalized)).toBe(normalized);
  });

  it("preserves custom-node properties through editor-state JSON parsing", () => {
    const markdown =
      '[note](chronicles://note/03awvyp9xobkv9t1jmmtiz0bp "title")\n\n![alt](../_attachments/image.png)\n\n| First | Second |\n| :--- | ---: |\n| a\\|b | `code` |';
    const editor = createEditor({
      namespace: "upgrade-json",
      nodes: lexicalNodes,
      onError: (error) => {
        throw error;
      },
    });
    editor.update(() => $loadMarkdownIntoLexical(markdown), { discrete: true });
    const serialized = editor.getEditorState().toJSON();
    const restored = createEditor({
      namespace: "upgrade-json",
      nodes: lexicalNodes,
      onError: (error) => {
        throw error;
      },
    });
    restored.setEditorState(restored.parseEditorState(serialized));
    expect(markdownOf(restored)).toBe(markdown);
  });

  it("edits an arbitrary code language without stripping code or fence metadata", async () => {
    const { editor } = await mountEditor(
      '```custom-language title="demo"\nfirst\nsecond\n```',
    );
    await act(async () => {
      editor.update(
        () => {
          $getRoot().getFirstChildOrThrow().selectStart();
        },
        { discrete: true },
      );
    });
    const field = await screen.findByLabelText("Code language");
    expect(field).toHaveValue("custom-language");
    fireEvent.change(field, { target: { value: "another-language" } });
    await waitFor(() =>
      expect(markdownOf(editor)).toBe(
        '```another-language title="demo"\nfirst\nsecond\n```',
      ),
    );
    expect(
      screen
        .getByLabelText("Editor")
        .querySelector("[data-highlight-language]"),
    ).toBeNull();
  });

  it.each([
    "![alt](../_attachments/image.png)",
    "| First | Second |\n| :--- | ---: |\n| a\\|b | `code` |",
  ])(
    "preserves a terminal decorator through focus, autosave and reopen: %s",
    async (decorator) => {
      const initial = `Start.\n\n\`\`\`custom-language title="demo"\nvalue\n\`\`\`\n\n${decorator}`;
      const notes = createMemoryNotesClient({
        journals: [{ id: "j1", name: "work" }],
        notes: [
          {
            id: "n1",
            journalId: "j1",
            title: "Upgrade",
            content: initial,
            createdAt: "2024-01-01T00:00:00.000Z",
            updatedAt: "2024-01-01T00:00:00.000Z",
          },
        ],
      });
      await notes.ready;
      const doc = new EditableDocument(
        notes,
        await notes.getNote({ id: "n1" }),
      );
      try {
        const { editor, view, onChange } = await mountEditor(
          initial,
          vi.fn(doc.setMarkdownContent),
        );
        await act(async () => {
          fireEvent.focus(screen.getByLabelText("Editor"));
        });
        // The writable paragraph after a terminal decorator exports one newline.
        expect(markdownOf(editor)).toBe(initial + "\n");
        expect(onChange).not.toHaveBeenCalled();
        await act(async () => {
          editor.update(
            () => {
              $getRoot().getFirstChildOrThrow().selectEnd();
            },
            { discrete: true },
          );
          editor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, " Edited.");
        });
        const expected = initial.replace("Start.", "Start. Edited.") + "\n";
        await waitFor(
          async () => {
            expect((await notes.getNote({ id: "n1" })).content).toBe(expected);
          },
          { timeout: 2500 },
        );
        view.unmount();
        const reopened = await mountEditor(
          (await notes.getNote({ id: "n1" })).content,
        );
        expect(markdownOf(reopened.editor)).toBe(expected);
      } finally {
        doc.teardown?.();
      }
    },
  );

  it("deletes all block types to a plain paragraph and restores them with undo", async () => {
    const initial = "# Heading\n\n- bullet\n\n> quote";
    const { editor } = await mountEditor(initial);
    await act(async () => {
      editor.update(
        () => {
          const root = $getRoot();
          root.select(0, root.getChildrenSize());
        },
        { discrete: true },
      );
      editor.dispatchCommand(
        KEY_BACKSPACE_COMMAND,
        new KeyboardEvent("keydown", { key: "Backspace" }),
      );
    });
    await waitFor(() => expect(markdownOf(editor)).toBe(""));
    expect(
      screen.getByLabelText("Editor").querySelector("h1, ul, blockquote"),
    ).toBeNull();
    await act(async () => {
      editor.dispatchCommand(UNDO_COMMAND, undefined);
    });
    await waitFor(() => expect(markdownOf(editor)).toBe(initial));
    await act(async () => {
      editor.dispatchCommand(REDO_COMMAND, undefined);
    });
    await waitFor(() => expect(markdownOf(editor)).toBe(""));
    await act(async () => {
      editor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, "Fresh text");
    });
    await waitFor(() => expect(markdownOf(editor)).toBe("Fresh text"));
  });

  it("cuts and pastes a whole document without losing its blocks or custom nodes", async () => {
    const initial =
      '# Heading\n\n```custom-language title="demo"\nvalue\n```\n\n[note](chronicles://note/03awvyp9xobkv9t1jmmtiz0bp)\n\n![alt](../_attachments/image.png)\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
    const { editor } = await mountEditor(initial);
    const clipboard = new Map<string, string>();
    await act(async () => {
      editor.update(
        () => {
          const root = $getRoot();
          root.select(0, root.getChildrenSize());
        },
        { discrete: true },
      );
      editor.dispatchCommand(CUT_COMMAND, clipboardEvent("cut", clipboard));
    });
    await waitFor(() => expect(markdownOf(editor)).toBe(""));
    expect(clipboard.has("application/x-lexical-editor")).toBe(true);
    await act(async () => {
      editor.dispatchCommand(PASTE_COMMAND, clipboardEvent("paste", clipboard));
    });
    await waitFor(() => expect(markdownOf(editor)).toBe(initial + "\n"));
  });

  it("uploads an image once when its clipboard also carries HTML", async () => {
    const notes = createMemoryNotesClient({
      journals: [{ id: "j1", name: "work" }],
      notes: [],
    });
    await notes.ready;
    const put = vi.spyOn(notes, "putAttachment").mockResolvedValue({
      url: "chronicles://../_attachments/image.png",
      sha256: "",
      ext: "png",
    });
    let editor!: LexicalEditor;
    render(
      <NotesContext.Provider value={notes}>
        <MemoryRouter>
          <LexicalBasedEditor
            initialMarkdown=""
            onMarkdownChange={vi.fn()}
            onEditorReady={(ready) => {
              editor = ready;
            }}
          />
        </MemoryRouter>
      </NotesContext.Provider>,
    );
    await waitFor(() => expect(editor).toBeDefined());
    const file = new File([new Uint8Array([1, 2, 3])], "image.png", {
      type: "image/png",
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    await act(async () => {
      editor.update(
        () => {
          $getRoot().selectEnd();
        },
        { discrete: true },
      );
      editor.dispatchCommand(
        PASTE_COMMAND,
        clipboardEvent(
          "paste",
          new Map([["text/html", '<img src="https://example.com/image.png">']]),
          [file],
        ),
      );
    });
    await waitFor(() =>
      expect(
        screen.getByLabelText("Editor").querySelectorAll("img[src]"),
      ).toHaveLength(1),
    );
    expect(put).toHaveBeenCalledTimes(1);
    expect(markdownOf(editor)).toBe(
      "![image.png](../_attachments/image.png)\n",
    );
  });
});
