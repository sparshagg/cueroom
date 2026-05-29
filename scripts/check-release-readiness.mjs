import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const failures = [];
const args = parseArgs(process.argv.slice(2));
const tag = args.tag ?? process.env.GITHUB_REF_NAME;
const requiredBeforeTaggingItems = [
  "PR branch is approved and merged into protected `main`.",
  "Human legal review confirms non-affiliation language, Netflix Terms boundary, and no content redistribution claim.",
  "Human privacy review confirms `PRIVACY.md`, Chrome Web Store privacy answers, and in-app data boundary match current behavior.",
  "Hosted privacy policy URL is live and matches `PRIVACY.md`.",
  "Public beta web domain is live and matches `apps/extension/src/manifest.json` `externally_connectable.matches`.",
  "Maintainer has enabled GitHub private vulnerability reporting for the public repository.",
  "Maintainer has watched the repository for security notifications.",
  "Current `main` has green `verify`, `docker`, `CodeQL`, `cleanup`, `supply-chain`, and `zap-baseline` checks.",
  "DAST workflow includes authenticated room-session create, join, and report-user flow evidence.",
  "Latest DAST artifacts are reviewed, and every medium/high finding is either fixed or explicitly accepted in a tracked security note.",
  "`pnpm extension:package` artifacts have been reviewed, including the ZIP, manifest audit, privacy policy copy, listing draft, and generated images.",
  "Release package `SHA256SUMS` verifies locally.",
  "`pnpm release:notes -- --tag v0.1.0 --output artifacts/release-notes/v0.1.0.md` has been reviewed for user-facing accuracy.",
  "`pnpm release:check -- --tag v0.1.0` passes before tagging.",
  "In-room report-user flow has API, UI, and regression coverage.",
  "No open high or critical security findings remain in CodeQL, Dependabot, DAST review, or manual security review.",
  "Release signing process is recorded in `RUNBOOK.md`, including the approved annotated-tag fallback if signing is unavailable."
];

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
  "docs/security/supply-chain.md",
  ".github/workflows/release.yml"
]) {
  if (!existsSync(path.resolve(requiredFile))) {
    failures.push(`Missing release readiness file: ${requiredFile}`);
  }
}

requireReleaseWorkflowIntegrity(".github/workflows/release.yml");

if (args.requireBetaGates) {
  requireCheckedSection(
    "docs/release/public-beta-checklist.md",
    "Required Before Tagging",
    "Required Before Chrome Web Store Submission",
    requiredBeforeTaggingItems
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

function requireReleaseWorkflowIntegrity(filePath) {
  if (!existsSync(path.resolve(filePath))) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  requireWorkflowNeedle(
    content,
    filePath,
    '      - "v*.*.*"',
    "release workflow runs on version tags"
  );
  requireWorkflowNeedle(
    content,
    filePath,
    "workflow_dispatch:",
    "release workflow supports manual dispatch"
  );
  requireWorkflowNeedle(
    content,
    filePath,
    "attestations: write",
    "release workflow can write artifact attestations"
  );
  requireWorkflowNeedle(
    content,
    filePath,
    "contents: write",
    "release workflow can create GitHub releases"
  );
  requireWorkflowNeedle(
    content,
    filePath,
    "id-token: write",
    "release workflow can mint OIDC tokens for attestations"
  );

  requireOrderedWorkflowNeedles(filePath, content, [
    ["pnpm security:supply-chain", "run supply-chain checks before release gates"],
    ["pnpm release:check --", "run repo release gates"],
    ['--tag "$RELEASE_TAG"', "check the requested release tag"],
    ["--require-annotated-tag", "require an annotated or signed release tag"],
    ["--require-main", "require the tag to be reachable from protected main"],
    ["--require-beta-gates", "require public beta checklist gates"],
    ["pnpm verify", "run full verification before packaging"],
    ["pnpm extension:package", "build the Chrome Web Store package"],
    [
      "artifacts/chrome-web-store/release-notes.md",
      "generate release notes into the package evidence directory"
    ],
    ["sha256sum -c SHA256SUMS", "verify packaged checksums"],
    ["actions/upload-artifact@v4", "upload Chrome Web Store evidence artifact"],
    ["actions/attest@v4", "generate package provenance attestation"],
    [
      "subject-path: ${{ steps.packaged-extension.outputs.zip_path }}",
      "attest the resolved extension ZIP"
    ],
    ['gh release create "$RELEASE_TAG"', "create the GitHub prerelease"],
    [
      "--notes-file artifacts/chrome-web-store/release-notes.md",
      "use reviewed release notes as the prerelease body"
    ],
    ["--prerelease", "mark the first beta release as a prerelease"],
    ["--verify-tag", "refuse to create a release for an implicit tag"]
  ]);

  requireWorkflowNeedle(
    content,
    filePath,
    'VERSION="${RELEASE_TAG#v}"',
    "derive package version from the release tag"
  );
  requireWorkflowNeedle(
    content,
    filePath,
    'ZIP_PATH="artifacts/chrome-web-store/cueroom-extension-${VERSION}.zip"',
    "select the exact versioned extension ZIP"
  );
  requireWorkflowNeedle(
    content,
    filePath,
    'test "$ZIP_COUNT" = "1"',
    "fail unless exactly one extension ZIP exists"
  );
  requireWorkflowNeedle(
    content,
    filePath,
    'test -f "$ZIP_PATH"',
    "fail when the expected extension ZIP is missing"
  );
  requireWorkflowNeedle(
    content,
    filePath,
    'grep -F "  cueroom-extension-${VERSION}.zip" artifacts/chrome-web-store/SHA256SUMS',
    "confirm the selected extension ZIP is listed in SHA256SUMS"
  );
  if (content.includes("ls artifacts/chrome-web-store/cueroom-extension-*.zip")) {
    failures.push(`${filePath} must not select the extension ZIP with ls/head glob ordering.`);
  }

  for (const requiredAttachment of [
    "${{ steps.packaged-extension.outputs.zip_path }}#CueRoom Chrome Web Store extension ZIP",
    "artifacts/chrome-web-store/SHA256SUMS#SHA256SUMS",
    "artifacts/chrome-web-store/release-manifest.json#Release manifest",
    "artifacts/chrome-web-store/release-notes.md#Release notes"
  ]) {
    requireWorkflowNeedle(
      content,
      filePath,
      requiredAttachment,
      `attach ${requiredAttachment.split("#")[1]} to the GitHub prerelease`
    );
  }
}

function requireWorkflowNeedle(content, filePath, needle, description) {
  if (!content.includes(needle)) {
    failures.push(`${filePath} must ${description}.`);
  }
}

function requireOrderedWorkflowNeedles(filePath, content, checks) {
  let previousIndex = -1;
  for (const [needle, description] of checks) {
    const index = content.indexOf(needle);
    if (index === -1) {
      failures.push(`${filePath} must ${description}.`);
      continue;
    }
    if (index < previousIndex) {
      failures.push(`${filePath} must ${description} after the prior release workflow gate.`);
      continue;
    }
    previousIndex = index;
  }
}

function requireCheckedSection(filePath, startHeading, endHeading, requiredItems = []) {
  const content = readFileSync(filePath, "utf8");
  const start = content.indexOf(`## ${startHeading}`);
  if (start === -1) {
    failures.push(`${filePath} is missing section: ${startHeading}`);
    return;
  }
  const end = endHeading ? content.indexOf(`## ${endHeading}`, start + 1) : -1;
  const section = content.slice(start, end === -1 ? undefined : end);
  const missingItems = requiredItems.filter(
    (item) => !section.includes(`- [ ] ${item}`) && !section.includes(`- [x] ${item}`)
  );
  if (missingItems.length > 0) {
    failures.push(`${filePath} is missing required release gates: ${missingItems.join("; ")}`);
  }
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
