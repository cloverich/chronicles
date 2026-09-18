#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const changelogPath = resolve(repository, "CHANGELOG.md");
const cursorPattern = /<!-- changelog-cursor: ([0-9a-f]{40}) -->/;
const entryPattern = /^- (\d{4}-\d{2}-\d{2}) ([0-9a-f]{7}) (.+)$/;
const coveragePattern = /<!-- commits: ([0-9a-f ]+) -->/g;
const ignoredTypes = new Set(["build", "chore", "ci", "docs", "style", "test"]);

function git(...args) {
  return execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function validate(source) {
  const lines = source.split("\n");
  if (lines[0] !== "# Changelog") {
    throw new Error("CHANGELOG.md must begin with '# Changelog'");
  }
  if (!source.includes("## Unreleased")) {
    throw new Error("CHANGELOG.md must contain '## Unreleased'");
  }
  const cursorMatches =
    source.match(new RegExp(cursorPattern.source, "g")) ?? [];
  if (cursorMatches.length !== 1) {
    throw new Error("CHANGELOG.md must contain exactly one changelog cursor");
  }

  for (const [index, line] of lines.entries()) {
    if (!line.startsWith("- ")) continue;
    const visible = line.replace(/\s*<!--.*?-->\s*$/, "");
    if (!entryPattern.test(visible)) {
      throw new Error(`Invalid changelog entry on line ${index + 1}: ${line}`);
    }
  }
}

function sentence(subject) {
  const withoutType = subject
    .replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, "")
    .trim();
  if (!withoutType) return subject;
  const text = withoutType[0].toUpperCase() + withoutType.slice(1);
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function coveredCommits(source) {
  const covered = new Set();
  for (const match of source.matchAll(coveragePattern)) {
    for (const sha of match[1].split(/\s+/)) covered.add(sha);
  }
  return covered;
}

function candidatesSince(ref, covered) {
  const format = "%H%x1f%cs%x1f%s%x1e";
  const output = git(
    "log",
    "--reverse",
    "--no-merges",
    `--format=${format}`,
    `${ref}..HEAD`,
  );
  if (!output) return [];

  return output
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, date, subject] = record.split("\x1f");
      return { sha, date, subject };
    })
    .filter(({ sha }) => !covered.has(sha))
    .filter(({ subject }) => {
      const match = /^([a-z]+)(?:\([^)]+\))?!?:\s+/i.exec(subject);
      return !match || !ignoredTypes.has(match[1].toLowerCase());
    });
}

function catchUp(source, explicitRef) {
  const cursor = cursorPattern.exec(source)?.[1];
  if (!cursor) throw new Error("Missing changelog cursor");
  const ref = explicitRef ?? cursor;
  git("cat-file", "-e", `${ref}^{commit}`);

  const candidates = candidatesSince(ref, coveredCommits(source));
  const head = git("rev-parse", "HEAD");
  const entries = candidates
    .reverse()
    .map(
      ({ sha, date, subject }) =>
        `- ${date} ${sha.slice(0, 7)} ${sentence(subject)} <!-- commits: ${sha} -->`,
    );
  const unreleasedPattern =
    /(## Unreleased\n\n)([\s\S]*?)(?=\n## |\n<!-- changelog-cursor:)/;
  const unreleased = unreleasedPattern.exec(source);
  if (!unreleased) throw new Error("Could not find the Unreleased section");
  const existingEntries = unreleased[2].split("\n").filter(Boolean);
  const mergedEntries = [...entries, ...existingEntries].sort((left, right) =>
    right.slice(2, 12).localeCompare(left.slice(2, 12)),
  );
  const next = source
    .replace(
      unreleasedPattern,
      `$1${mergedEntries.length > 0 ? `${mergedEntries.join("\n")}\n` : ""}`,
    )
    .replace(cursorPattern, `<!-- changelog-cursor: ${head} -->`);
  return { source: next, added: candidates.length };
}

const args = process.argv.slice(2);
const command = args[0] === "check" ? "check" : "catchup";
const sinceIndex = args.indexOf("--since");
const explicitRef = sinceIndex >= 0 ? args[sinceIndex + 1] : undefined;
if (sinceIndex >= 0 && !explicitRef) {
  console.error("--since requires a tag or commit");
  process.exit(1);
}

const source = readFileSync(changelogPath, "utf8");
try {
  validate(source);
  if (command === "check") {
    console.log("CHANGELOG.md format is valid.");
  } else {
    const result = catchUp(source, explicitRef);
    if (result.source === source) {
      console.log("CHANGELOG.md is already caught up.");
    } else {
      validate(result.source);
      writeFileSync(changelogPath, result.source);
      console.log(
        `Caught up CHANGELOG.md with ${result.added} candidate ${result.added === 1 ? "entry" : "entries"}.`,
      );
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
