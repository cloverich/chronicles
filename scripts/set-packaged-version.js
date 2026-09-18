// ./scripts/set-packaged-version.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inferVersionFromEnv = () => {
  const lastTag = process.env.GIT_TAG || "0.0.0";
  const tag = lastTag.replace(/^v/, "");
  const commitSha = process.env.GIT_COMMIT_SHA || "unknown";
  const fullCommitSha = process.env.GIT_COMMIT_FULL_SHA || commitSha;
  const commitCount = process.env.GIT_COMMIT_COUNT || "0";
  const date =
    process.env.BUILD_DATE ||
    new Date().toISOString().split("T")[0].replace(/-/g, "");

  // If the tag is a release tag, we don't need to modify it
  let version = tag;

  // If there are uncommitted changes or commits since the last tag, we need to
  // bump the version and amend it with the commit / date information
  if (commitCount !== "0" || process.env.GIT_UNCOMMITTED_CHANGES === "true") {
    const [major, minor, patch] = tag.split("."); // v0, 4, 0
    const nextTag = `${major}.${parseInt(minor) + 1}.${patch}`; // v0.5.0

    if (process.env.GIT_UNCOMMITTED_CHANGES === "true") {
      version = `${nextTag}-dev-uncommited-${date}`;
    } else if (commitCount !== "0") {
      version = `${nextTag}-dev-${commitCount}-${date}-${commitSha}`;
    }
  }

  return {
    version,
    commit: fullCommitSha,
    shortCommit: commitSha,
    lastTag,
    commitsAfterTag: Number(commitCount),
    buildDate: date.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
    dirty: process.env.GIT_UNCOMMITTED_CHANGES === "true",
  };
};

const setVersionInPackageJson = (metadata) => {
  const packageJsonPath = path.join(__dirname, "../dist", "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  packageJson.version = metadata.version;
  packageJson.buildMetadata = metadata;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`Updated version to ${metadata.version}`);
};

setVersionInPackageJson(inferVersionFromEnv());
