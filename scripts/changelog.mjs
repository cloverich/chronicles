#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const changelogPath = resolve(repository, "CHANGELOG.md");
const entryPattern = /^- (\d{4}-\d{2}-\d{2}) ([0-9a-f]{7}) (\S.*)$/;
const limit = 50;

function git(...args) {
  return execFileSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function subject(text) {
  const plain = text.replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, "").trim();
  return plain ? plain[0].toUpperCase() + plain.slice(1) : text;
}

function commits(args) {
  const output = git(
    "log",
    "--date=short",
    "--format=%H%x1f%ad%x1f%s",
    ...args,
  );
  return output
    ? output.split("\n").map((line) => {
        const [sha, date, message] = line.split("\x1f");
        return { sha, line: `${date} ${sha.slice(0, 7)} ${subject(message)}` };
      })
    : [];
}

function check(source) {
  const lines = source.split("\n");
  if (lines[0] !== "# Changelog")
    throw new Error("CHANGELOG.md must begin with '# Changelog'");
  if (!lines.includes("## Unreleased"))
    throw new Error("CHANGELOG.md needs ## Unreleased");
  if (source.includes("<!--"))
    throw new Error("CHANGELOG.md contains hidden metadata");
  const shas = [];
  for (const [index, line] of lines.entries()) {
    if (
      line.startsWith("## ") &&
      line !== "## Unreleased" &&
      !/^## v?\d+\.\d+(?:\.\d+)? — \d{4}-\d{2}-\d{2}$/.test(line)
    )
      throw new Error(`Invalid heading on line ${index + 1}`);
    if (!line.startsWith("- ")) continue;
    const match = entryPattern.exec(line);
    if (!match || line.includes("<!--") || !line.endsWith("."))
      throw new Error(`Invalid changelog entry on line ${index + 1}`);
    shas.push(match[2]);
  }
  if (shas.length === 0) throw new Error("CHANGELOG.md has no entries");
  const result = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", shas[0], "HEAD"],
    { cwd: repository },
  );
  if (result.status !== 0)
    throw new Error(`Top curated SHA ${shas[0]} is not an ancestor of HEAD`);
  for (let index = 1; index < shas.length; index++) {
    const order = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", shas[index], shas[index - 1]],
      { cwd: repository },
    );
    if (order.status !== 0)
      throw new Error(`Curated SHA ${shas[index]} is out of order`);
  }
  const headTags = git("tag", "--points-at", "HEAD")
    .split("\n")
    .filter(Boolean);
  for (const tag of headTags) {
    if (!/^v?\d+\.\d+\.\d+$/.test(tag)) continue;
    const version = tag.replace(/^v/, "");
    if (!lines.some((line) => line.startsWith(`## ${version} — `))) {
      throw new Error(`Release ${tag} needs a matching changelog heading`);
    }
  }
  return shas[0];
}

function rawSince(top) {
  return commits([`${top}..HEAD`]).map(({ line }) => line);
}

function buildInfo() {
  const all = commits(["-n", String(limit + 1)]);
  return {
    commit: git("rev-parse", "--short=7", "HEAD"),
    date: new Date().toISOString().slice(0, 10),
    dirty: Boolean(git("status", "--porcelain")),
    raw: all.slice(0, limit).map(({ line }) => line),
    truncated:
      all.length > limit ||
      git("rev-parse", "--is-shallow-repository") === "true",
  };
}

try {
  const source = readFileSync(changelogPath, "utf8");
  const top = check(source);
  const mode = process.argv[2];
  if (mode === "--check" || mode === "check") {
    // Validation above is the entire check.
  } else if (mode === "--raw") {
    const lines = rawSince(top);
    if (lines.length) process.stdout.write(`${lines.join("\n")}\n`);
  } else if (mode === "--build-info") {
    process.stdout.write(`${JSON.stringify(buildInfo())}\n`);
  } else if (mode === undefined) {
    const lines = rawSince(top);
    if (lines.length) {
      const marker = "## Unreleased\n";
      const entries = lines
        .map((line) => `- ${line.endsWith(".") ? line : `${line}.`}`)
        .join("\n");
      const updated = source.replace(marker, `${marker}\n${entries}\n`);
      check(updated);
      writeFileSync(changelogPath, updated);
    }
  } else if (mode === "--release") {
    const version = process.argv[3]?.replace(/^v/, "");
    if (!version || !/^\d+\.\d+\.\d+$/.test(version))
      throw new Error("Usage: changelog --release <version>");
    if (source.includes(`\n## ${version} — `))
      throw new Error(`CHANGELOG.md already has ${version}`);
    const marker = "## Unreleased\n";
    const start = source.indexOf(marker) + marker.length;
    const next = source.indexOf("\n## ", start);
    const unreleased = source.slice(start, next === -1 ? undefined : next);
    if (!/^- /m.test(unreleased))
      throw new Error("## Unreleased has no entries to release");
    const date = new Date().toISOString().slice(0, 10);
    const updated = source.replace(
      marker,
      `${marker}\n## ${version} — ${date}\n`,
    );
    check(updated);
    writeFileSync(changelogPath, updated);
  } else {
    throw new Error(
      "Usage: changelog [--check | --raw | --build-info | --release <version>]",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
