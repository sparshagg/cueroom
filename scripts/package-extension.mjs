import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDist = path.join(repoRoot, "apps/extension/dist");
const artifactDir = path.join(repoRoot, "artifacts/chrome-web-store");
const deterministicZipDate = new Date("2026-01-01T00:00:00.000Z");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    ...options
  });
}

await rm(artifactDir, { recursive: true, force: true });
await mkdir(artifactDir, { recursive: true });

run("pnpm", ["--filter", "@cueroom/shared", "build"]);
run("pnpm", ["--filter", "@cueroom/security", "build"]);
run("pnpm", ["--filter", "@cueroom/ui", "build"]);
run("pnpm", ["--filter", "@cueroom/web", "build"]);
run("pnpm", ["--filter", "@cueroom/extension", "build"]);
run("node", ["scripts/generate-store-assets.mjs"]);

const manifestPath = path.join(extensionDist, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const version = manifest.version;
const zipName = `cueroom-extension-${version}.zip`;
const zipPath = path.join(artifactDir, zipName);

await normalizePackageTimestamps(extensionDist);
const zipEntries = await listPackageFiles(extensionDist);
run("zip", ["-Xq", zipPath, ...zipEntries], { cwd: extensionDist });
const zipSha256 = createHash("sha256")
  .update(await readFile(zipPath))
  .digest("hex");
const commitSha = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repoRoot,
  encoding: "utf8"
}).trim();

const auditOutput = execFileSync("pnpm", ["security:extension"], {
  cwd: repoRoot,
  encoding: "utf8"
});

await cp(manifestPath, path.join(artifactDir, "manifest.json"));
await cp(
  path.join(repoRoot, "docs/security/chrome-web-store-review.md"),
  path.join(artifactDir, "chrome-web-store-review.md")
);
await cp(path.join(repoRoot, "PRIVACY.md"), path.join(artifactDir, "PRIVACY.md"));
await cp(
  path.join(repoRoot, "docs/release/chrome-web-store-listing.md"),
  path.join(artifactDir, "chrome-web-store-listing.md")
);
await cp(
  path.join(repoRoot, "docs/release/chrome-web-store-privacy-answers.md"),
  path.join(artifactDir, "chrome-web-store-privacy-answers.md")
);
await cp(
  path.join(repoRoot, "docs/release/public-beta-checklist.md"),
  path.join(artifactDir, "public-beta-checklist.md")
);
await writeFile(path.join(artifactDir, "manifest-audit.txt"), auditOutput);
await writeFile(path.join(artifactDir, "SHA256SUMS"), `${zipSha256}  ${zipName}\n`);
await writeFile(
  path.join(artifactDir, "release-manifest.json"),
  `${JSON.stringify(
    {
      commit: commitSha,
      generatedAt: new Date().toISOString(),
      manifestVersion: version,
      package: zipName,
      packageSha256: zipSha256,
      reviewEvidence: [
        "manifest.json",
        "manifest-audit.txt",
        "PRIVACY.md",
        "chrome-web-store-listing.md",
        "chrome-web-store-privacy-answers.md",
        "chrome-web-store-review.md",
        "public-beta-checklist.md"
      ]
    },
    null,
    2
  )}\n`
);
await writeFile(
  path.join(artifactDir, "README.md"),
  [
    "# CueRoom Chrome Web Store Package",
    "",
    `- ZIP: \`${zipName}\``,
    `- Manifest version: \`${version}\``,
    `- SHA-256: \`${zipSha256}\``,
    "- Upload the ZIP itself; the manifest is at the ZIP root.",
    "- Verify `SHA256SUMS` before submission.",
    "- Store screenshots and promo tiles are in `images/`.",
    "- Use the included privacy policy, listing draft, privacy answers draft, and review checklist for Developer Dashboard fields."
  ].join("\n") + "\n"
);

console.info(`Chrome Web Store package written to ${zipPath}`);

async function normalizePackageTimestamps(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await normalizePackageTimestamps(entryPath);
    }
    await utimes(entryPath, deterministicZipDate, deterministicZipDate);
  }
  await utimes(directory, deterministicZipDate, deterministicZipDate);
}

async function listPackageFiles(directory, baseDirectory = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listPackageFiles(entryPath, baseDirectory)));
      continue;
    }
    if ((await stat(entryPath)).isFile()) {
      files.push(path.relative(baseDirectory, entryPath));
    }
  }
  return files;
}
