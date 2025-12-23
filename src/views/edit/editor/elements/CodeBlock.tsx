import React from "react";

import { cn, withRef } from "@udecode/cn";
import { PlateElement, useEditorRef } from "@udecode/plate/react";
import { Transforms } from "slate";
import { ReactEditor } from "slate-react";

import { CODE_BLOCK_LANGUAGES } from "../plate-types";

const knownLangOptions: { label: string; value: string }[] = [
  { label: "Plain Text", value: "text" },
  ...Object.entries(CODE_BLOCK_LANGUAGES).map(([key, val]) => ({
    label: val as string,
    value: key,
  })),
];

// Set initial selected language, with some defaults.
function defaultLang(lang: string | null) {
  if (!lang) return "text";
  if (lang === "js") return "javascript";
  if (lang === "ts") return "typescript";

  // NOTE: If lang is a language not found in the menus above, it will default to "Plain text"
  // in the dropdown.
  return lang;
}

// On first render, if the language is not in the known options, add it to the list.
// This is to support unknown languages that are in the underlying markdown, but not known
// to the language list above; syntax highlighting will not work.
function amendLanguageOptions(lang: string) {
  if (!knownLangOptions.find((l) => l.value === lang)) {
    return [{ label: lang, value: lang }, ...knownLangOptions];
  }

  return knownLangOptions;
}

// className -> slate-code_block
// props -> attributes, editor, element
export const CodeBlockElement = withRef<typeof PlateElement>(
  ({ children, className, ...props }, ref) => {
    const { element } = props;
    const editor = useEditorRef();
    const [lang, setLang] = React.useState(defaultLang(element.lang as string));

    // When the language changes, update Slate/Plate nodes.
    React.useEffect(() => {
      if (element.lang !== lang) {
        const path = ReactEditor.findPath(editor as any, element);
        if (!path) return;
        Transforms.setNodes(editor as any, { lang } as any, { at: path });
      }
    }, [lang]);

    return (
      <PlateElement
        className={cn("max-w-code relative my-8 bg-muted", className)}
        ref={ref}
        {...props}
      >
        <pre className="font-code overflow-x-auto rounded-md px-6 pb-4 pt-10 text-sm leading-[normal] [tab-size:2]">
          <code spellCheck={false}>{children}</code>
        </pre>
        <div
          className="absolute right-2 top-2 z-10 select-none"
          contentEditable={false}
        >
          <LanguageSelect lang={lang} setLang={setLang} />
        </div>
      </PlateElement>
    );
  },
);

interface LangSelectProps {
  lang: string;
  setLang: (lang: string) => void;
}

/**
 * Dropdown menu for selecting the language of a code block.
 */
function LanguageSelect({ lang, setLang }: LangSelectProps) {
  function onChange(e: any) {
    setLang(e.target.value);
  }

  const languageOptions = React.useMemo(() => {
    const languages = amendLanguageOptions(lang);

    return languages.map((language) => (
      <option key={language.value} value={language.value}>
        {language.label}
      </option>
    ));
  }, []);

  return (
    <select value={lang} onChange={onChange} className="bg-muted">
      {languageOptions}
    </select>
  );
}
