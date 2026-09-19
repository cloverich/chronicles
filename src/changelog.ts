export interface ChangelogLink {
  kind: "link";
  label: string;
  href: string;
}

export interface ChangelogText {
  kind: "text";
  value: string;
}

export type ChangelogPart = ChangelogLink | ChangelogText;

export interface ChangelogEntry {
  date: string;
  sha: string;
  parts: ChangelogPart[];
}

export interface ChangelogRelease {
  title: string;
  entries: ChangelogEntry[];
}

const entryPattern = /^- (\d{4}-\d{2}-\d{2}) ([0-9a-f]{7}) (.+)$/;
const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

export function parseInlineLinks(value: string): ChangelogPart[] {
  const parts: ChangelogPart[] = [];
  let cursor = 0;
  for (const match of value.matchAll(linkPattern)) {
    const index = match.index ?? cursor;
    if (index > cursor) {
      parts.push({ kind: "text", value: value.slice(cursor, index) });
    }
    parts.push({ kind: "link", label: match[1], href: match[2] });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) {
    parts.push({ kind: "text", value: value.slice(cursor) });
  }
  return parts.length > 0 ? parts : [{ kind: "text", value }];
}

export function parseChangelog(source: string): ChangelogRelease[] {
  const lines = source.split("\n");
  if (lines[0] !== "# Changelog") {
    throw new Error("Changelog must begin with '# Changelog'");
  }

  const releases: ChangelogRelease[] = [];
  let release: ChangelogRelease | undefined;
  for (const [index, line] of lines.entries()) {
    if (line.startsWith("## ")) {
      release = { title: line.slice(3), entries: [] };
      releases.push(release);
      continue;
    }
    if (!line.startsWith("- ")) continue;
    if (!release) {
      throw new Error(
        `Changelog entry precedes a release heading on line ${index + 1}`,
      );
    }
    const visible = line.replace(/\s*<!--[\s\S]*?-->\s*$/, "");
    const match = entryPattern.exec(visible);
    if (!match) {
      throw new Error(`Invalid changelog entry on line ${index + 1}`);
    }
    release.entries.push({
      date: match[1],
      sha: match[2],
      parts: parseInlineLinks(match[3]),
    });
  }

  return releases;
}
