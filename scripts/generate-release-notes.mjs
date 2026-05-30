import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const rootPackage = readJson("package.json");
const releaseTag = args.tag ?? `v${rootPackage.version}`;
const outputPath = args.output ?? path.join("artifacts", "release-notes", `${releaseTag}.md`);
const targetRef = resolveTargetRef(releaseTag);
const previousTag = args.previousTag ?? resolvePreviousTag(releaseTag, targetRef);
const commits = readCommits(targetRef, previousTag);
const notes = renderReleaseNotes({
  commits,
  previousTag,
  releaseTag,
  targetDate: gitOutput(["show", "-s", "--format=%cI", targetRef]),
  targetRef
});

await mkdir(path.dirname(path.resolve(repoRoot, outputPath)), { recursive: true });
await writeFile(path.resolve(repoRoot, outputPath), notes);

console.info(`Release notes written to ${outputPath}`);

function parseArgs(rawArgs) {
  const parsed = {
    output: undefined,
    previousTag: undefined,
    tag: undefined
  };
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--tag") {
      parsed.tag = requireValue(rawArgs, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--previous-tag") {
      parsed.previousTag = requireValue(rawArgs, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--output") {
      parsed.output = requireValue(rawArgs, index, arg);
      index += 1;
      continue;
    }
    throw new Error(`Unknown release notes argument: ${arg}`);
  }
  return parsed;
}

function requireValue(rawArgs, index, arg) {
  const value = rawArgs[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${arg} requires a value`);
  }
  return value;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(path.resolve(repoRoot, filePath), "utf8"));
}

function resolveTargetRef(tagName) {
  const tagRef = `refs/tags/${tagName}`;
  return gitSucceeds(["rev-parse", "--verify", tagRef]) ? tagRef : "HEAD";
}

function resolvePreviousTag(tagName, targetRef) {
  const currentVersion = parseSemverTag(tagName);
  const candidates = gitLines(["for-each-ref", "--format=%(refname:short)", "refs/tags/v*"])
    .filter((candidate) => candidate !== tagName)
    .map((candidate) => ({ tag: candidate, version: parseSemverTag(candidate) }))
    .filter(
      ({ tag, version }) => version && gitSucceeds(["merge-base", "--is-ancestor", tag, targetRef])
    )
    .filter(({ version }) => !currentVersion || compareSemver(version, currentVersion) < 0)
    .sort((left, right) => compareSemver(right.version, left.version));

  return candidates[0]?.tag;
}

function parseSemverTag(tagName) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tagName);
  if (!match) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

function compareSemver(left, right) {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

function readCommits(targetRef, fromTag) {
  const range = fromTag ? `${fromTag}..${targetRef}` : targetRef;
  const raw = gitOutput(["log", "--reverse", "--format=%x1e%H%x1f%s%x1f%B", range]);
  return raw
    .split("\u001e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map(parseCommitRecord);
}

function parseCommitRecord(record) {
  const [hash, subject, body = ""] = record.split("\u001f");
  const conventional =
    /^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?: (?<description>.+)$/.exec(subject);
  const footerBreaking = /(?:^|\n)BREAKING(?: |-)?CHANGE:\s*(?<text>.+)/.exec(body);
  return {
    body,
    breaking: Boolean(conventional?.groups?.breaking || footerBreaking),
    breakingText: footerBreaking?.groups?.text,
    description: conventional?.groups?.description ?? subject,
    hash,
    scope: conventional?.groups?.scope,
    subject,
    type: conventional?.groups?.type?.toLowerCase() ?? "other"
  };
}

function renderReleaseNotes({ commits, previousTag, releaseTag, targetDate, targetRef }) {
  const groups = groupCommits(commits);
  const lines = [
    `# CueRoom ${releaseTag} Release Notes`,
    "",
    "## Publisher Checklist",
    "",
    "- [ ] Legal/privacy beta gates are complete before publishing.",
    "- [ ] Extension ZIP checksum and artifact attestation are verified before Chrome Web Store upload.",
    "- [ ] Release copy keeps CueRoom non-affiliated with Netflix and does not imply content streaming, recording, redistribution, download, or DRM bypass.",
    "",
    "## Release Metadata",
    "",
    `- Tag: \`${releaseTag}\``,
    `- Previous tag: ${previousTag ? `\`${previousTag}\`` : "none; first release notes include all reachable commits"}`,
    `- Git target: \`${targetRef}\``,
    `- Target commit date: \`${targetDate}\``,
    "",
    "## Highlights",
    ""
  ];

  const highlights = groups.get("Features") ?? [];
  if (highlights.length === 0) {
    lines.push("- No feature commits in this range.");
  } else {
    lines.push(...highlights.map(formatCommit));
  }

  if (groups.get("Breaking Changes")?.length) {
    lines.push("", "## Breaking Changes", "");
    lines.push(...groups.get("Breaking Changes").map(formatBreakingCommit));
  }

  for (const [heading, entries] of groups) {
    if (heading === "Features" || heading === "Breaking Changes" || entries.length === 0) {
      continue;
    }
    lines.push("", `## ${heading}`, "");
    lines.push(...entries.map(formatCommit));
  }

  if (commits.length === 0) {
    lines.push("", "## Changes", "", "- No commits found in this release range.");
  }

  return `${lines.join("\n")}\n`;
}

function groupCommits(commits) {
  const groups = new Map([
    ["Breaking Changes", []],
    ["Features", []],
    ["Fixes", []],
    ["Security", []],
    ["Performance", []],
    ["Documentation", []],
    ["Build & CI", []],
    ["Tests", []],
    ["Maintenance", []],
    ["Other", []]
  ]);

  for (const commit of commits) {
    if (commit.breaking) {
      groups.get("Breaking Changes").push(commit);
    }
    groups.get(categoryForType(commit.type)).push(commit);
  }
  return groups;
}

function categoryForType(type) {
  if (type === "feat") {
    return "Features";
  }
  if (type === "fix") {
    return "Fixes";
  }
  if (type === "security") {
    return "Security";
  }
  if (type === "perf") {
    return "Performance";
  }
  if (type === "docs") {
    return "Documentation";
  }
  if (type === "build" || type === "ci") {
    return "Build & CI";
  }
  if (type === "test") {
    return "Tests";
  }
  if (type === "chore" || type === "refactor" || type === "style") {
    return "Maintenance";
  }
  return "Other";
}

function formatCommit(commit) {
  const scope = commit.scope ? `**${commit.scope}:** ` : "";
  return `- ${scope}${commit.description} (${shortHash(commit.hash)})`;
}

function formatBreakingCommit(commit) {
  const details = commit.breakingText ? ` - ${commit.breakingText}` : "";
  return `${formatCommit(commit)}${details}`;
}

function shortHash(hash) {
  return hash.slice(0, 7);
}

function gitLines(args) {
  const output = gitOutput(args);
  return output ? output.split("\n").filter(Boolean) : [];
}

function gitOutput(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function gitSucceeds(args) {
  return spawnSync("git", args, { cwd: repoRoot, stdio: "ignore" }).status === 0;
}
