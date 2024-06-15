import { mdastToSlate } from "../transformers/mdast-to-slate";

export default function remarkToSlatePlugin() {
  // @ts-ignore
  this.Compiler = function (node: any) {
    return mdastToSlate(node);
  };
}
