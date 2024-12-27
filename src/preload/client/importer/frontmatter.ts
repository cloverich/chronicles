import { Stats } from "fs";
import yaml from "yaml";
import { mdastToString, parseMarkdown } from "../../../markdown";
import { SourceType } from "../importer/SourceType";
import { FrontMatter } from "../types";

interface ParseTitleAndFrontMatterRes {
  frontMatter: Partial<FrontMatter>;
  body: string;
}

interface RawExtractFrontMatterResponse {
  title: string;
  rawFrontMatter: string;
  body: string;
}

function parseAndNormalizeDate(dateString: string): Date | null {
  if (isNaN(Date.parse(dateString))) {
    return null;
  }

  const parsedDate = new Date(dateString); // Parse the best-effort date

  return new Date(
    // interpret as UTC
    Date.UTC(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate(),
      parsedDate.getHours(),
      parsedDate.getMinutes(),
      parsedDate.getSeconds(),
    ),
  );
}

/**
 * For notes within Chronicles (created by it, or already imported). Other logic in this file
 * is for importing documents that may have front matter, or may not, in different formats, etc.
 *
 * @param content
 * @param stats - to set defaults and ensure dates are always present
 * @returns - { frontMatter, body }
 */
export function parseChroniclesFrontMatter(content: string, stats: Stats) {
  const { frontMatter, body } = extractFronMatter(content);

  frontMatter.tags = frontMatter.tags || [];
  frontMatter.title = frontMatter.title;
  frontMatter.createdAt =
    frontMatter.createdAt || (stats.birthtime || stats.mtime).toISOString();
  frontMatter.updatedAt = frontMatter.updatedAt || stats.mtime.toISOString();

  return {
    frontMatter,
    body,
  } as { frontMatter: FrontMatter; body: string };
}

export const parseTitleAndFrontMatterForImport = (
  contents: string,
  filename: string,
  sourceType: SourceType,
): ParseTitleAndFrontMatterRes => {
  let fm;

  // My Notion files were all in a database and hence exported with
  // a kind of "front matter"; can pull title from that.
  if (sourceType === "notion") {
    fm = parseTitleAndFrontMatterNotion(contents);
  } else {
    fm = parseTitleAndFrontMatterDefault(contents, filename);
  }

  if (!Array.isArray(fm.frontMatter.tags)) {
    fm.frontMatter.tags = [fm.frontMatter.tags as any].filter(
      Boolean,
    ) as string[];
  }

  return fm;
};

// For importing documents, staging phase; this is for
// non-Notion markdown documents, that may have front matter
// demarcated the typical way (--- at top of file), or not at all.
function parseTitleAndFrontMatterDefault(
  contents: string,
  filename: string,
): ParseTitleAndFrontMatterRes {
  // note: unlike the importer processing phase, we do not parse ofmWiki or ofmTags
  // here; because we don't convert them here, only re-serialize the body without the
  // front matter. If they are parsed here, this routine will phase since it lacks
  // serialization logic for those nodes.
  const { frontMatter, body } = extractFronMatter(contents);

  frontMatter.title = frontMatter.title || filename;
  return {
    frontMatter,
    body,
  };
}

function extractFronMatter(contents: string): {
  frontMatter: Partial<FrontMatter>;
  body: string;
} {
  let frontMatter = {};
  let body = contents.trim();

  if (body) {
    const mdast = parseMarkdown(body);

    if (mdast.children[0].type === "yaml") {
      frontMatter = yaml.parse(mdast.children[0].value);
      mdast.children = mdast.children.slice(1);
      body = mdastToString(mdast);
    }
  }

  return { frontMatter, body };
}

/**
 * Parses a string of contents into a title, front matter, and body; strips title / frontmatter
 * from the body.
 */
function parseTitleAndFrontMatterNotion(
  contents: string,
): ParseTitleAndFrontMatterRes {
  const { title, rawFrontMatter, body } = extractRawFrontMatterNotion(contents);
  const frontMatter = rawFrontMatter.length
    ? parseExtractedFrontMatterNotion(rawFrontMatter)
    : {};

  frontMatter.title = title;
  return { frontMatter, body };
}

/**
 * Attempt to extract a title and front matter from a string of contents;
 * return the original body on error.
 */
function extractRawFrontMatterNotion(
  contents: string,
): RawExtractFrontMatterResponse {
  try {
    const lines = contents.split("\n");

    let title = "";
    let rawFrontMatter: string = "";
    let bodyStartIndex = 0;

    // Process the title (assuming it's the first line starting with '#')
    if (lines[0].startsWith("#")) {
      title = lines[0].replace(/^#\s*/, "").trim();
      bodyStartIndex = 1; // Move index to the next line
    }

    // Check for front matter by looking line by line until an empty line
    let frontMatterLines = [];

    // Notion style front matter has no --- border, just new lines; but support
    // --- style too b/c that is what I used in other notes.... this is maybe stupid
    // supporting both in the same importer. Likely refactor when this is properly abstracted
    // :hopesanddreams:
    let fontMatterBorderTriggered = false;
    let tripleDashBorderTriggered = false;

    // Notion style document is:
    // title, newline, frontmatter(optional), newline(if front matter), body
    let firstEmptyLineEncountered = false;

    for (let i = bodyStartIndex; i < lines.length; i++) {
      const line = lines[i].trim();

      // Track the start of frontmatter if using ---, so we can later
      // detect --- and infer the end of front matter (as opposed to an empty line)
      if (i == bodyStartIndex && line == "---") {
        fontMatterBorderTriggered = true;
        tripleDashBorderTriggered = true;
        continue;
      }

      // Stop if we reach a closing --- (indicating end of front matter)
      if (
        i > bodyStartIndex &&
        fontMatterBorderTriggered &&
        tripleDashBorderTriggered &&
        line.startsWith("---")
      ) {
        bodyStartIndex = i + 1; // Move index to start of body content
        break;
      }

      // Stop if we reach an empty line (indicating end of front matter)
      if (line === "" && !fontMatterBorderTriggered) {
        if (firstEmptyLineEncountered) {
          bodyStartIndex = i + 1; // Move index to start of body content
          break;
        } else {
          firstEmptyLineEncountered = true;
          continue;
        }
      }

      // Add potential front matter lines for processing
      bodyStartIndex = i + 1;
      frontMatterLines.push(lines[i]);
    }

    // technically we'd get here with a malformed document, that doesn't close its front matter (---),
    // and documents with front matter but no body; only dealing with the latter for now.

    // At this point, we have one of:
    // Front matter, body content remaining
    // Front matter, no body
    // No front matter, body content is in frontMatterLines, and body content remains (multipe paragraphs)
    // No front matter, body content is in frontMatterLines, and no body content remains
    // In the last case... we need to evaluate the length of the first key

    if ((!tripleDashBorderTriggered && bodyStartIndex > lines.length, lines)) {
      // no body content and not classic front matter, just front matter
      // first, if it does not parse, we will just return the whole thing as body
      try {
        yaml.parse(frontMatterLines.join("\n"));
        // It does parse; now check if the first key is super long
        // if so, we assume it's a body, not front matter
        if (frontMatterLines[0].split(":")[0].length > 20) {
          // error irrelevant; handler returns the whole thing as body
          throw Error("First key is too long; assuming it's a body");
        }
      } catch (err) {
        return {
          title,
          rawFrontMatter: "",
          body: title
            ? lines.length > 1
              ? lines.slice(1).join("\n").trim()
              : ""
            : lines.join("\n")?.trim(),
        };
      }
    }

    if (frontMatterLines.length) {
      rawFrontMatter = frontMatterLines.join("\n");
    }

    // The remaining lines form the body
    const body = lines.slice(bodyStartIndex).join("\n").trim();
    return { title, rawFrontMatter, body };
  } catch (err) {
    // tood: something more sophisticated here
    console.error("Error extracting raw front matter from contents", err);
    console.log("Contents:", contents);
    return { title: "", rawFrontMatter: "", body: contents };
  }
}

/**
 * Parse the front matter from a string that has already been processed
 * by preprocessRawFrontMatter.
 */
function parseExtractedFrontMatterNotion(rawFrontMatter: string) {
  const processedFrontMatter = preprocessRawFrontMatterNotion(rawFrontMatter);

  try {
    // NOTE: Returns a string if no front matter is present...wtf.
    const frontMatter: string | Record<string, any> =
      yaml.parse(processedFrontMatter);

    if (typeof frontMatter === "string") {
      return {};
    }

    if (frontMatter.Tags) {
      frontMatter.tags = frontMatter.Tags;
      delete frontMatter.Tags;
    }

    // Process tags if present
    if (frontMatter.tags != null) {
      frontMatter.tags = frontMatter.tags
        .split(",")
        .map((tag: string) => tag.trim())
        .filter(Boolean);
    }

    // Idiosyncratic handling of my particular front matter keys
    // 1. I have createdAt key, but format is August 12, 2020 8:13 PM
    // 2. updatedAt is key "Last Edited"
    // In both cases re-name to createdAt/updatedAt, convert to ISO string;
    // discard if empty; log and discard if cannot parse
    if ("Last Edited" in frontMatter) {
      const lastEdited = frontMatter["Last Edited"];
      if (lastEdited === "") {
        delete frontMatter["Last Edited"];
      } else {
        const date = parseAndNormalizeDate(lastEdited);
        if (date) {
          frontMatter.updatedAt = date.toISOString();
          delete frontMatter["Last Edited"];
        } else {
          console.warn("Invalid date format for 'Last Edited':", lastEdited);
        }
      }
    }

    if (frontMatter.createdAt != null) {
      if (frontMatter.createdAt === "") {
        delete frontMatter.createdAt;
      } else {
        const date = parseAndNormalizeDate(frontMatter.createdAt);
        if (date) {
          frontMatter.createdAt = date.toISOString();
        } else {
          console.warn(
            "Invalid date format for 'createdAt':",
            frontMatter.createdAt,
          );
          delete frontMatter.createdAt;
        }
      }
    }

    return frontMatter;
  } catch (e) {
    console.error("Error parsing front matter", e);
    console.log("Front matter:", rawFrontMatter);
    return {};
  }
}

/**
 * Clean-up raw front matter as seen in my Notion export that was tripping
 * up the yaml parser.
 *
 * See body comments for explanations. Should be called on the raw string before
 * calling yaml.parse.
 */
function preprocessRawFrontMatterNotion(content: string) {
  return (
    content
      // Handle keys with no values by assigning empty strings
      .replace(/^(\w+):\s*$/gm, '$1: ""')

      // Check if value contains special characters and quote them if necessary
      .replace(/^(\w+):\s*(.+)$/gm, (match, key, value) => {
        // If the value contains special characters or a newline, quote the value
        if (value.match(/[:{}[\],&*#?|\-<>=!%@`]/) || value.includes("\n")) {
          // If the value isn't already quoted, add double quotes
          if (!/^['"].*['"]$/.test(value)) {
            // Escape any existing double quotes in the value
            value = value.replace(/"/g, '\\"');
            return `${key}: "${value}"`;
          }
        }
        return match; // Return unchanged if no special characters
      })
  );
}
