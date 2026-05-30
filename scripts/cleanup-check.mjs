import { existsSync } from "node:fs";
import { readdir, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const repoRoot = path.resolve(process.env.CUEROOM_CLEANUP_ROOT ?? process.cwd());
const pruneGenerated = args.has("--prune-generated");
const pruneTrackedGenerated = args.has("--prune-tracked-generated");
const skipKnip = args.has("--skip-knip") || process.env.CUEROOM_CLEANUP_SKIP_KNIP === "1";
const generatedDirectoryNames = new Set([
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "artifacts",
  "playwright-report",
  "test-results"
]);
const generatedFileNames = new Set([".DS_Store"]);
const scanDirectories = ["apps", "packages", "scripts", "infra", "skills", "docs", ".github"];
const rootFiles = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "DECISIONS.md",
  "LEARNINGS.md",
  "PLAN.md",
  "README.md",
  "RUNBOOK.md",
  "SECURITY.md",
  "THREAT_MODEL.md",
  "package.json",
  "knip.json",
  "pnpm-workspace.yaml"
];
const findings = [];
const prunedGenerated = [];
const trackedPaths = listTrackedPaths();
const scannedFiles = new Set();

function toRepoPath(filePath) {
  const relativePath = path.relative(repoRoot, filePath).split(path.sep).join("/");
  return relativePath || ".";
}

function listTrackedPaths() {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8"
  });
  if (result.status !== 0) {
    return new Set();
  }

  return new Set(result.stdout.split("\0").filter(Boolean));
}

function hasTrackedChild(directoryPath) {
  const directoryRepoPath = toRepoPath(directoryPath);
  return [...trackedPaths].some(
    (trackedPath) =>
      trackedPath === directoryRepoPath || trackedPath.startsWith(`${directoryRepoPath}/`)
  );
}

async function handleGeneratedDirectory(directoryPath) {
  const repoPath = toRepoPath(directoryPath);
  if (hasTrackedChild(directoryPath) && !pruneTrackedGenerated) {
    findings.push(
      `Tracked generated artifact must be removed in a reviewed PR, not pruned automatically: ${repoPath}`
    );
    return;
  }

  if (pruneGenerated) {
    await rm(directoryPath, { recursive: true, force: true });
    prunedGenerated.push(repoPath);
    return;
  }

  findings.push(
    `Generated artifact directory should be pruned with pnpm cleanup:prune: ${repoPath}`
  );
}

async function handleGeneratedFile(filePath) {
  const repoPath = toRepoPath(filePath);
  if (trackedPaths.has(repoPath) && !pruneTrackedGenerated) {
    findings.push(
      `Tracked generated artifact must be removed in a reviewed PR, not pruned automatically: ${repoPath}`
    );
    return true;
  }

  if (pruneGenerated) {
    await rm(filePath, { force: true });
    prunedGenerated.push(repoPath);
    return true;
  }

  findings.push(`Generated artifact file should be pruned with pnpm cleanup:prune: ${repoPath}`);
  return true;
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      if (generatedDirectoryNames.has(entry.name)) {
        await handleGeneratedDirectory(fullPath);
        continue;
      }
      await walk(fullPath);
      continue;
    }
    await scanFile(fullPath);
  }
}

async function scanFile(filePath) {
  const normalizedPath = path.resolve(filePath);
  if (scannedFiles.has(normalizedPath)) {
    return;
  }
  scannedFiles.add(normalizedPath);

  const fileName = path.basename(filePath);
  const repoPath = toRepoPath(filePath);
  if (generatedFileNames.has(fileName) || fileName.endsWith(".tsbuildinfo")) {
    await handleGeneratedFile(filePath);
    return;
  }
  if (pruneGenerated) {
    return;
  }
  if (/(\.bak|\.tmp|\.orig|~)$/.test(fileName)) {
    findings.push(`Temporary file should be removed: ${repoPath}`);
  }
  if (/\.(ts|tsx|js|mjs|md|json|ya?ml|css|html)$/.test(fileName)) {
    const fileStat = await stat(filePath);
    if (fileStat.size === 0) {
      findings.push(`Empty source/doc/config file: ${repoPath}`);
    }
  }
}

for (const root of generatedDirectoryNames) {
  const fullPath = path.join(repoRoot, root);
  if (existsSync(fullPath)) {
    await handleGeneratedDirectory(fullPath);
  }
}

for (const entry of await readdir(repoRoot, { withFileTypes: true })) {
  if (entry.isFile()) {
    await scanFile(path.join(repoRoot, entry.name));
  }
}

for (const root of scanDirectories) {
  const fullPath = path.join(repoRoot, root);
  if (existsSync(fullPath)) {
    await walk(fullPath);
  }
}

for (const rootFile of rootFiles) {
  const fullPath = path.join(repoRoot, rootFile);
  if (existsSync(fullPath)) {
    await scanFile(fullPath);
  }
}

if (!pruneGenerated && !skipKnip && existsSync(path.join(repoRoot, "node_modules/.bin/knip"))) {
  const result = spawnSync("pnpm", ["exec", "knip", "--no-progress"], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8"
  });
  if (result.status !== 0) {
    findings.push(`knip reported cleanup candidates:\n${result.stdout}${result.stderr}`);
  }
}

if (findings.length > 0) {
  console.error("Cleanup check found issues:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

if (prunedGenerated.length > 0) {
  console.info(`Pruned generated artifacts: ${prunedGenerated.join(", ")}`);
}

console.info(pruneGenerated ? "Cleanup prune passed." : "Cleanup check passed.");
