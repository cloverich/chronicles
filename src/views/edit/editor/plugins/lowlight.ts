/**
 * Lowlight configuration for syntax highlighting in code blocks.
 *
 * Uses lowlight (highlight.js) instead of Prism for syntax highlighting.
 * Languages are registered individually to keep bundle size reasonable.
 *
 * @see https://github.com/wooorm/lowlight
 * @see https://platejs.org/docs/code-block
 */
import { createLowlight } from "lowlight";

// Import individual languages to keep bundle size manageable
// Using highlight.js language definitions
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import go from "highlight.js/lib/languages/go";
import graphql from "highlight.js/lib/languages/graphql";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

// Create lowlight instance
export const lowlight = createLowlight();

// Register languages
lowlight.register("bash", bash);
lowlight.register("shell", bash); // alias
lowlight.register("sh", bash); // alias
lowlight.register("c", c);
lowlight.register("cpp", cpp);
lowlight.register("csharp", csharp);
lowlight.register("cs", csharp); // alias
lowlight.register("css", css);
lowlight.register("diff", diff);
lowlight.register("go", go);
lowlight.register("graphql", graphql);
lowlight.register("java", java);
lowlight.register("javascript", javascript);
lowlight.register("js", javascript); // alias
lowlight.register("json", json);
lowlight.register("kotlin", kotlin);
lowlight.register("markdown", markdown);
lowlight.register("md", markdown); // alias
lowlight.register("php", php);
lowlight.register("python", python);
lowlight.register("py", python); // alias
lowlight.register("ruby", ruby);
lowlight.register("rb", ruby); // alias
lowlight.register("rust", rust);
lowlight.register("rs", rust); // alias
lowlight.register("sql", sql);
lowlight.register("swift", swift);
lowlight.register("typescript", typescript);
lowlight.register("ts", typescript); // alias
lowlight.register("xml", xml);
lowlight.register("html", xml); // HTML uses XML highlighter
lowlight.register("yaml", yaml);
lowlight.register("yml", yaml); // alias

// JSX/TSX use their base language highlighters
lowlight.register("jsx", javascript);
lowlight.register("tsx", typescript);
