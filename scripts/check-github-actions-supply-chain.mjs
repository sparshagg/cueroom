import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.env.CUEROOM_ACTIONS_ROOT ?? process.cwd());
const workflowDir = path.join(repoRoot, ".github/workflows");
const fullShaPattern = /^[a-f0-9]{40}$/i;
const allowedActions = new Map([
  ["actions/attest", "59d89421af93a897026c735860bf21b6eb4f7b26"],
  ["actions/checkout", "34e114876b0b11c390a56381ad16ebd13914f8d5"],
  ["actions/download-artifact", "d3f86a106a0bac45b974a628896c90dbdf5c8093"],
  ["actions/github-script", "f28e40c7f34bde8b3046d885e986cb6290c5673b"],
  ["actions/setup-node", "49933ea5288caeca8642d1e84afbd3f7d6820020"],
  ["actions/upload-artifact", "ea165f8d65b6e75b540449e92b4886f43607fa02"],
  ["docker/setup-buildx-action", "8d2750c68a42422c14e847fe6c8ac0403b4cbd6f"],
  ["github/codeql-action", "03e4368ac7daa2bd82b3e85262f3bf87ee112f57"],
  ["pnpm/action-setup", "b906affcce14559ad1aafd4ab0e942779e9f58b1"],
  ["zaproxy/action-baseline", "de8ad967d3548d44ef623df22cf95c3b0baf8b25"]
]);
const allowedWriteScopes = new Map([
  [".github/workflows/cleanup.yml", new Set(["contents", "issues", "pull-requests"])],
  [".github/workflows/codeql.yml", new Set(["security-events"])],
  [".github/workflows/release.yml", new Set(["attestations", "contents", "id-token"])]
]);
const failures = [];

for (const workflowFileName of readdirSync(workflowDir).filter((fileName) =>
  /\.ya?ml$/.test(fileName)
)) {
  const absolutePath = path.join(workflowDir, workflowFileName);
  const repoPath = toRepoPath(absolutePath);
  const content = readFileSync(absolutePath, "utf8");
  checkActionReferences(repoPath, content);
  checkPermissionWrites(repoPath, content);
}

if (failures.length > 0) {
  console.error("GitHub Actions supply-chain check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.info("GitHub Actions supply-chain check passed.");

function checkActionReferences(repoPath, content) {
  for (const [lineIndex, line] of content.split("\n").entries()) {
    const match = line.match(/^\s*(?:-\s*)?uses:\s*["']?([^"'\s#]+)["']?/);
    if (!match) {
      continue;
    }

    const reference = match[1];
    if (reference.startsWith("./")) {
      continue;
    }

    if (reference.startsWith("docker://")) {
      failures.push(`${repoPath}:${lineIndex + 1}: docker action references are not allowed.`);
      continue;
    }

    const parsed = parseActionReference(reference);
    if (!parsed) {
      failures.push(`${repoPath}:${lineIndex + 1}: invalid action reference ${reference}.`);
      continue;
    }

    const expectedSha = allowedActions.get(parsed.action);
    if (!expectedSha) {
      failures.push(`${repoPath}:${lineIndex + 1}: action ${parsed.action} is not allowlisted.`);
      continue;
    }

    if (!fullShaPattern.test(parsed.ref)) {
      failures.push(
        `${repoPath}:${lineIndex + 1}: action ${parsed.action} must be pinned to a full 40-character commit SHA.`
      );
      continue;
    }

    if (parsed.ref !== expectedSha) {
      failures.push(
        `${repoPath}:${lineIndex + 1}: action ${parsed.action} must use reviewed SHA ${expectedSha}.`
      );
    }
  }
}

function checkPermissionWrites(repoPath, content) {
  const allowedScopes = allowedWriteScopes.get(repoPath) ?? new Set();
  for (const [lineIndex, line] of content.split("\n").entries()) {
    const trimmed = line.trim();
    if (/^permissions:\s*write-all\s*$/.test(trimmed)) {
      failures.push(`${repoPath}:${lineIndex + 1}: permissions must not use write-all.`);
      continue;
    }

    const match = trimmed.match(/^([a-z][a-z-]*):\s*write\s*(?:#.*)?$/);
    if (!match) {
      continue;
    }

    const scope = match[1];
    if (!allowedScopes.has(scope)) {
      failures.push(`${repoPath}:${lineIndex + 1}: write permission ${scope} is not approved.`);
    }
  }
}

function parseActionReference(reference) {
  const atIndex = reference.lastIndexOf("@");
  if (atIndex === -1) {
    return null;
  }

  const actionPath = reference.slice(0, atIndex);
  const ref = reference.slice(atIndex + 1);
  const parts = actionPath.split("/");
  if (parts.length < 2 || !ref) {
    return null;
  }

  return {
    action: `${parts[0]}/${parts[1]}`,
    ref
  };
}

function toRepoPath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}
