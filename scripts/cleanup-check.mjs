import { existsSync } from "node:fs";
import { readdir, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

const generatedDirectoryNames = new Set([".next", ".turbo", "coverage", "dist", "build"]);
const sourceRoots = ["apps", "packages", "scripts", "infra", "skills"];
const findings = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        continue;
      }
      if (generatedDirectoryNames.has(entry.name)) {
        await rm(fullPath, { recursive: true, force: true });
        continue;
      }
      await walk(fullPath);
      continue;
    }
    if (/(\.bak|\.tmp|\.orig|~)$/.test(entry.name)) {
      findings.push(`Temporary file should be removed: ${fullPath}`);
    }
    if (entry.name === ".DS_Store") {
      findings.push(`Generated desktop metadata should be removed: ${fullPath}`);
    }
    if (/\.(ts|tsx|js|mjs|md)$/.test(entry.name)) {
      const fileStat = await stat(fullPath);
      if (fileStat.size === 0) {
        findings.push(`Empty source/doc file: ${fullPath}`);
      }
    }
  }
}

for (const root of sourceRoots) {
  if (existsSync(root)) {
    await walk(root);
  }
}

for (const root of generatedDirectoryNames) {
  if (existsSync(root)) {
    await rm(root, { recursive: true, force: true });
  }
}

if (existsSync("node_modules/.bin/knip")) {
  const result = spawnSync("pnpm", ["exec", "knip", "--no-progress"], {
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

console.info("Cleanup check passed.");
