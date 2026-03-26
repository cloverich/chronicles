import { $isCodeNode, getCodeLanguageOptions } from "@lexical/code";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, $getSelection, $isRangeSelection } from "lexical";
import { CheckIcon, CopyIcon } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";

interface CodeLanguageState {
  key: string;
  language: string;
}

interface PickerPosition {
  top: number;
  right: number;
}

const codeLanguageOptions = getCodeLanguageOptions();

const codeLanguageOptionElements = codeLanguageOptions.map(([value, label]) => (
  <option key={value} value={value}>
    {label}
  </option>
));

function getCodeLanguageState(): CodeLanguageState | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  const parent = anchorNode.getParent();
  const codeNode = $isCodeNode(anchorNode)
    ? anchorNode
    : $isCodeNode(parent)
      ? parent
      : null;

  if (!$isCodeNode(codeNode)) {
    return null;
  }

  return {
    key: codeNode.getKey(),
    language: codeNode.getLanguage() ?? "plain",
  };
}

function getPickerPosition(codeElement: HTMLElement): PickerPosition {
  const rect = codeElement.getBoundingClientRect();
  return {
    top: rect.top + 4,
    right: window.innerWidth - rect.right + 4,
  };
}

export function LexicalCodeLanguagePlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = React.useState<CodeLanguageState | null>(null);
  const [hasCopied, setHasCopied] = React.useState(false);
  const [position, setPosition] = React.useState<PickerPosition | null>(null);
  const codeElementRef = React.useRef<HTMLElement | null>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      let next: CodeLanguageState | null = null;
      editorState.read(() => {
        next = getCodeLanguageState();
      });

      setState((current) => {
        if (
          current?.key === next?.key &&
          current?.language === next?.language
        ) {
          return current;
        }
        return next;
      });
    });
  }, [editor]);

  // Sync position with the code element, including on scroll/resize.
  const syncPosition = React.useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = codeElementRef.current;
      if (!el) return;
      setPosition(getPickerPosition(el));
    });
  }, []);

  React.useEffect(() => {
    if (!state) {
      codeElementRef.current = null;
      setPosition(null);
      return;
    }

    const el = editor.getElementByKey(state.key);
    if (!(el instanceof HTMLElement)) {
      codeElementRef.current = null;
      setPosition(null);
      return;
    }

    codeElementRef.current = el;
    setPosition(getPickerPosition(el));

    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [editor, state, syncPosition]);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (!state) return;
      const selectedLanguage = event.target.value;
      editor.update(() => {
        const node = $getNodeByKey(state.key);
        if (!$isCodeNode(node)) {
          return;
        }
        node.setLanguage(
          selectedLanguage === "plain" ? undefined : selectedLanguage,
        );
      });
    },
    [editor, state],
  );

  const handleCopy = React.useCallback(() => {
    if (!state) return;
    const text = editor.getEditorState().read(() => {
      const node = $getNodeByKey(state.key);
      return node ? node.getTextContent() : "";
    });
    navigator.clipboard.writeText(text).then(() => {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    });
  }, [editor, state]);

  if (!state || !position || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="flex gap-0.5 select-none"
      contentEditable={false}
      data-testid="lexical-code-language-picker"
      style={{
        position: "fixed",
        top: position.top,
        right: position.right,
        zIndex: 5,
      }}
    >
      <select
        className="text-muted-foreground bg-muted/80 h-6 cursor-pointer rounded px-1.5 text-xs outline-none"
        value={state.language}
        onChange={handleChange}
        aria-label="Code language"
      >
        {codeLanguageOptionElements}
      </select>
      <button
        className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center rounded"
        onClick={handleCopy}
        title="Copy code"
      >
        {hasCopied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      </button>
    </div>,
    document.body,
  );
}
