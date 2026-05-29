import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const failures = [];
const args = parseArgs(process.argv.slice(2));
const tag = args.tag ?? process.env.GITHUB_REF_NAME;

if (!tag) {
  failures.push("Release tag is required. Pass --tag vX.Y.Z.");
} else if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  failures.push(`Release tag must use vMAJOR.MINOR.PATCH format: ${tag}`);
}

const rootPackage = readJson("package.json");
const extensionManifest = readJson("apps/extension/src/manifest.json");
const expectedTag = `v${rootPackage.version}`;

if (tag && tag !== expectedTag) {
  failures.push(`Release tag ${tag} must match package.json version ${expectedTag}.`);
}
if (extensionManifest.version !== rootPackage.version) {
  failures.push(
    `Extension manifest version ${extensionManifest.version} must match package.json version ${rootPackage.version}.`
  );
}

for (const requiredFile of [
  "PRIVACY.md",
  "SECURITY.md",
  "THREAT_MODEL.md",
  "RUNBOOK.md",
  "docs/release/legal-privacy-review.md",
  "docs/release/chrome-web-store-listing.md",
  "docs/release/public-beta-checklist.md",
  "docs/security/chrome-web-store-review.md",
  "docs/security/incident-response.md",
  "docs/security/supply-chain.md"
]) {
  if (!existsSync(path.resolve(requiredFile))) {
    failures.push(`Missing release readiness file: ${requiredFile}`);
  }
}

if (args.requireBetaGates) {
  requireCheckedSection(
    "docs/release/public-beta-checklist.md",
    "Required Before Tagging",
    "Required Before Chrome Web Store Submission"
  );
}

if (args.requireAnnotatedTag && tag) {
  requireAnnotatedTag(tag);
}

if (args.requireMain && tag) {
  requireTagOnMain(tag);
}

if (failures.length > 0) {
  console.error("Release readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.info(`Release readiness check passed for ${tag ?? expectedTag}.`);

function parseArgs(rawArgs) {
  const parsed = {
    requireAnnotatedTag: false,
    requireBetaGates: false,
    requireMain: false,
    tag: undefined
  };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--tag") {
      parsed.tag = rawArgs[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--require-annotated-tag") {
      parsed.requireAnnotatedTag = true;
      continue;
    }
    if (arg === "--require-beta-gates") {
      parsed.requireBetaGates = true;
      continue;
    }
    if (arg === "--require-main") {
      parsed.requireMain = true;
      continue;
    }
    failures.push(`Unknown release check argument: ${arg}`);
  }
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function requireCheckedSection(filePath, startHeading, endHeading) {
  const content = readFileSync(filePath, "utf8");
  const start = content.indexOf(`## ${startHeading}`);
  if (start === -1) {
    failures.push(`${filePath} is missing section: ${startHeading}`);
    return;
  }
  const end = endHeading ? content.indexOf(`## ${endHeading}`, start + 1) : -1;
  const section = content.slice(start, end === -1 ? undefined : end);
  const unchecked = section
    .split("\n")
    .filter((line) => /^- \[ \] /.test(line))
    .map((line) => line.replace(/^- \[ \] /, ""));
  if (unchecked.length > 0) {
    failures.push(`${filePath} has unchecked required release gates: ${unchecked.join("; ")}`);
  }
}

function requireAnnotatedTag(tagName) {
  const tagRef = `refs/tags/${tagName}`;
  if (!gitSucceeds(["rev-parse", "--verify", tagRef])) {
    failures.push(`Git tag does not exist locally: ${tagName}`);
    return;
  }
  const objectType = gitOutput(["cat-file", "-t", tagRef]);
  if (objectType !== "tag") {
    failures.push(`Release tag must be an annotated or signed tag object: ${tagName}`);
  }
  const headSha = gitOutput(["rev-parse", "HEAD"]);
  const tagSha = gitOutput(["rev-list", "-n", "1", tagRef]);
  if (headSha !== tagSha) {
    failures.push(`Checked-out HEAD ${headSha} does not match release tag ${tagName} (${tagSha}).`);
  }
}

function requireTagOnMain(tagName) {
  if (!gitSucceeds(["rev-parse", "--verify", `refs/tags/${tagName}`])) {
    return;
  }
  const tagSha = gitOutput(["rev-list", "-n", "1", `refs/tags/${tagName}`]);
  if (!gitSucceeds(["rev-parse", "--verify", "origin/main"])) {
    failures.push("origin/main is required to confirm the release tag is on protected main.");
    return;
  }
  if (!gitSucceeds(["merge-base", "--is-ancestor", tagSha, "origin/main"])) {
    failures.push(`Release tag ${tagName} must point to a commit contained in origin/main.`);
  }
}

function gitOutput(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function gitSucceeds(args) {
  return spawnSync("git", args, { stdio: "ignore" }).status === 0;
}
