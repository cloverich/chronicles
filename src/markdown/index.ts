import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkUnwrapImages from "remark-unwrap-images";
import { Node as SNode } from "slate";
import { unified } from "unified";
import { remarkToSlate, slateToRemark } from "./remark-slate-transformer";

export * from "ts-mdast";

// I usually forget how unified works, so just leaving some notes for reference
// https://github.com/orgs/unifiedjs/discussions/113
// | ........................ process ........................... |
// | .......... parse ... | ... run ... | ... stringify ..........|
//
//           +--------+                     +----------+
// Input ->- | Parser | ->- Syntax Tree ->- | Compiler | ->- Output
//           +--------+          |          +----------+
//                               X
//                               |
//                        +--------------+
//                        | Transformers |
//                        +--------------+
const stringifier = unified().use(remarkStringify);
const parser = unified().use(remarkParse).use(remarkGfm);

const slateToStringProcessor = unified()
  .use(slateToRemark)
  .use(remarkGfm)
  .use(remarkStringify);

const stringToSlateProcessor = parser
  .use(remarkUnwrapImages)
  .use(remarkToSlate);

export function mdastToString(mdast: any): string {
  // todo: types
  return stringifier.stringify(mdast) as any;
}

export function stringToMdast(text: string) {
  return parser.parse(text);
}

export function stringToSlate(text: string) {
  // remarkToSlate must use a newer version, where file.result exists
  // file.contents also exists here... maybe the compilers are overlapping since
  // they modify in place? shrug
  // https://github.com/unifiedjs/unified/releases/tag/9.0.0
  // const output = stringToSlateProcessor.processSync(text);
  const mdast = stringToSlateProcessor.parse(text);
  // console.log("mdast", JSON.stringify(mdast, null, 2));
  const transformed = stringToSlateProcessor.runSync(mdast);
  // console.log("transformed", JSON.stringify(transformed, null, 2));
  const output = stringToSlateProcessor.stringify(transformed);
  // console.log("output", JSON.stringify(output, null, 2));
  // return (output as any).result;
  return output as any;
}

/**
 * debug helper function to see the slate to mdast conversion
 * before stringifying
 */
export function slateToMdast(nodes: SNode[]): any {
  return slateToStringProcessor.runSync({
    type: "root",
    children: nodes,
  });
}

export function slateToString(nodes: SNode[]): string {
  // per documentation https://github.com/inokawa/remark-slate-transformer/
  // slate value must be wrapped. Remark's parse expects a string while `run`
  // operates on ASTs
  const ast = slateToStringProcessor.runSync({
    type: "root",
    children: nodes,
  });

  return slateToStringProcessor.stringify(ast) as any;
}
