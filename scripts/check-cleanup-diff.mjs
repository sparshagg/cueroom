import { spawnSync } from "node:child_process";
import path from "node:path";

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

const changedPaths = [
  ...listChangedPaths(["diff", "--name-only", "-z"]),
  ...listChangedPaths(["diff", "--cached", "--name-only", "-z"])
].filter((changedPath, index, paths) => paths.indexOf(changedPath) === index);
const disallowedPaths = changedPaths.filter((changedPath) => !isGeneratedPath(changedPath));

if (disallowedPaths.length > 0) {
  console.error("Cleanup diff contains non-generated paths:");
  for (const disallowedPath of disallowedPaths) {
    console.error(`- ${disallowedPath}`);
  }
  process.exit(1);
}

console.info(
  changedPaths.length === 0
    ? "Cleanup diff is empty."
    : `Cleanup diff is generated-only: ${changedPaths.join(", ")}`
);

function listChangedPaths(args) {
  const result = spawnSync("git", args, {
    stdio: "pipe",
    encoding: "utf8"
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result.stdout.split("\0").filter(Boolean);
}

function isGeneratedPath(changedPath) {
  const parts = changedPath.split(/[\\/]+/);
  const fileName = path.basename(changedPath);
  return (
    parts.some((part) => generatedDirectoryNames.has(part)) ||
    generatedFileNames.has(fileName) ||
    fileName.endsWith(".tsbuildinfo")
  );
}
