/**
 * Shrink a Chronicles library's media to the Large policy (see
 * src/node-client/shrink.ts). Dry run unless --apply. Quit the app first.
 *
 *   yarn shrink-library --app                       # dry run on the app's library
 *   yarn shrink-library --app --apply --backup ~/Desktop/chronicles-before-shrink.zip
 *   yarn shrink-library --notes-dir <dir> --db <chronicles.db> [--apply ...]
 *
 * Options: --no-images, --no-videos, --no-sweep, --encoder libx264|h264_videotoolbox,
 * --no-backup (with --apply, skip the backup), --verbose (one line per file).
 */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { parseArgs } from "util";
import { createClient } from "../src/node-client/factory";
import { findFfmpeg } from "../src/node-client/media-policy";

const { values: args } = parseArgs({
  options: {
    app: { type: "boolean", default: false },
    "notes-dir": { type: "string" },
    db: { type: "string" },
    apply: { type: "boolean", default: false },
    backup: { type: "string" },
    "no-backup": { type: "boolean", default: false },
    "no-images": { type: "boolean", default: false },
    "no-videos": { type: "boolean", default: false },
    "no-sweep": { type: "boolean", default: false },
    encoder: { type: "string" },
    verbose: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

function usage(msg?: string): never {
  if (msg) console.error(msg + "\n");
  const doc = fs.readFileSync(new URL(import.meta.url), "utf8");
  console.error(doc.slice(doc.indexOf("/**"), doc.indexOf("*/") + 2));
  process.exit(msg ? 1 : 0);
}
if (args.help) usage();

const MB = (n: number) => `${(n / 1e6).toFixed(1)} MB`;
const pct = (before: number, after: number) =>
  before ? `${Math.round((1 - after / before) * 100)}%` : "0%";

let notesDir = args["notes-dir"];
let dbPath = args.db;
if (args.app) {
  const userData = path.join(
    os.homedir(),
    "Library/Application Support/Chronicles",
  );
  const settings = JSON.parse(
    fs.readFileSync(path.join(userData, "settings.json"), "utf8"),
  );
  notesDir ??= settings.notesDir;
  dbPath ??= path.join(userData, "chronicles.db");
}
if (!notesDir || !dbPath) usage("Give --app, or both --notes-dir and --db.");
if (!fs.existsSync(dbPath)) usage(`No database at ${dbPath}`);
if (!fs.existsSync(notesDir)) usage(`No notes directory at ${notesDir}`);

if (args.apply) {
  if (!args.backup && !args["no-backup"])
    usage("--apply needs --backup <path.zip> (or --no-backup).");
  let running = false;
  try {
    execFileSync("pgrep", ["-x", "Chronicles"], { stdio: "ignore" });
    running = true;
  } catch {
    // not running
  }
  if (running) usage("Chronicles is running. Quit it first.");
}

const ffmpeg = args["no-videos"]
  ? undefined
  : await findFfmpeg(args.encoder as any);

console.log(`Library:  ${notesDir}`);
console.log(`Database: ${dbPath}`);
if (ffmpeg) console.log(`Video encoder: ${ffmpeg.encoder}`);
console.log(
  args.apply ? "Mode: APPLY\n" : "Mode: dry run (nothing is written)\n",
);

// Settings go to a scratch dir: this script must not touch the app's settings.
const settingsDir = fs.mkdtempSync(path.join(os.tmpdir(), "chronicles-cli-"));
const client = await createClient({ dbPath, notesDir, settingsDir });

try {
  if (args.apply && args.backup) {
    const dest = path.resolve(args.backup.replace(/^~(?=\/)/, os.homedir()));
    const t0 = Date.now();
    console.log(`Backing up to ${dest} …`);
    const exp = await client.export.export(dest, {
      format: dest.endsWith(".zip") ? "archive" : "folder",
    });
    if (exp.attachments.missing.length > 0) {
      console.log(
        `  note: ${exp.attachments.missing.length} referenced attachments are missing from the library`,
      );
    }
    const dbCopy = dest.replace(/\.zip$/, "") + ".chronicles.db";
    client.sqlite.exec(`VACUUM INTO '${dbCopy.replace(/'/g, "''")}'`);
    console.log(
      `  ${exp.notes} notes, ${exp.attachments.copied} attachments; database copy ${dbCopy} (${((Date.now() - t0) / 1000).toFixed(1)} s)\n`,
    );
  }

  let done = 0;
  const report = await client.shrink.run({
    apply: args.apply,
    images: !args["no-images"],
    videos: !args["no-videos"],
    sweep: !args["no-sweep"],
    ffmpeg,
    onFile: (f) => {
      done++;
      if (args.verbose || f.kind === "video") {
        console.log(
          `  ${f.kind} ${f.name.slice(0, 12)}…${path.extname(f.name)}  ${MB(f.before)} → ${f.estimated ? "~" : ""}${MB(f.after)}  (${f.notes} note${f.notes === 1 ? "" : "s"}, ${(f.ms / 1000).toFixed(1)} s)`,
        );
      } else if (done % 50 === 0) {
        console.log(`  … ${done} files`);
      }
    },
  });

  const verb = report.applied ? "" : "would ";
  console.log("");
  console.log(
    `Images: ${report.images.files} files ${MB(report.images.before)} → ${MB(report.images.after)} (−${pct(report.images.before, report.images.after)})`,
  );
  console.log(
    `Videos: ${report.videos.files} files ${MB(report.videos.before)} → ${report.applied ? "" : "~"}${MB(report.videos.after)} (−${pct(report.videos.before, report.videos.after)})`,
  );
  console.log(`Notes ${verb}rewritten: ${report.notes}`);
  console.log(
    `Unused attachments ${verb}removed: ${report.unused.files} files, ${MB(report.unused.bytes)}`,
  );
  console.log(
    `Library (_attachments): ${MB(report.library.before)} → ${report.applied ? "" : "~"}${MB(report.library.after)} (−${pct(report.library.before, report.library.after)})`,
  );
  if (report.errors.length > 0) {
    console.log(`\n${report.errors.length} files left as they were:`);
    for (const e of report.errors) console.log(`  ${e.name}: ${e.error}`);
  }
  console.log(`\nTook ${(report.ms / 1000).toFixed(1)} s.`);
  if (!report.applied)
    console.log("Dry run. Re-run with --apply --backup <path.zip> to shrink.");
} finally {
  client.sqlite.close();
  fs.rmSync(settingsDir, { recursive: true, force: true });
}
