import React from "react";

import { cn, withRef } from "@udecode/cn";
import { useCodeBlockElementState } from "@udecode/plate-code-block";
import {
  PlateElement,
  findNodePath,
  useEditorRef,
} from "@udecode/plate-common";

import { CODE_BLOCK_LANGUAGES } from "@udecode/plate-code-block";
import { Transforms } from "slate";

const languages: { label: string; value: string }[] = [
  { label: "Plain Text", value: "text" },
  ...Object.entries({
    // doesn't include python? But does SVG and GraphQL? WTF?
    // ...CODE_BLOCK_LANGUAGES_POPULAR,
    ...CODE_BLOCK_LANGUAGES,
  }).map(([key, val]) => ({
    label: val as string,
    value: key,
  })),
];

// className -> slate-code_block
// state -> { className: '', syntax: true }
// props -> attributes, editor, element
// The Typescript types for ...props are wrong? They say slot, style, onChange, ...266 more
// Instead I see: attributes: data-slate-node: element
// element: lang (null), meta (null), type (code_block), children (node content)
export const CodeBlockElement = withRef<typeof PlateElement>(
  ({ children, className, ...props }, ref) => {
    const { element } = props;
    const editor = useEditorRef();
    const [lang, setLang] = React.useState((element.lang as string) || "plain");

    // When the language changes, update S|Plate nodes.
    React.useEffect(() => {
      if (element.lang !== lang) {
        const path = findNodePath(editor, element);
        if (!path) return;
        Transforms.setNodes(editor as any, { lang } as any, { at: path });
      }
    }, [lang]);

    const state = useCodeBlockElementState({ element });

    return (
      <PlateElement
        className={cn("relative py-1", state.className, className)}
        ref={ref}
        {...props}
      >
        <pre className="overflow-x-auto rounded-md bg-muted px-6 py-8 font-mono text-sm leading-[normal] [tab-size:2]">
          <code>{children}</code>
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
    return languages.map((language) => (
      <option key={language.value} value={language.value}>
        {language.label}
      </option>
    ));
  }, [languages]);

  return (
    <select value={lang} onChange={onChange} className="bg-muted">
      {languageOptions}
    </select>
  );
}
