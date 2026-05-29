import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = path.join(repoRoot, "artifacts/chrome-web-store");
const failures = [];

const packageJson = await readJson(path.join(repoRoot, "package.json"));
const manifest = await readJson(path.join(artifactDir, "manifest.json"));
const releaseManifest = await readJson(path.join(artifactDir, "release-manifest.json"));

const expectedVersion = packageJson.version;
const expectedZipName = `cueroom-extension-${expectedVersion}.zip`;
const zipPath = path.join(artifactDir, expectedZipName);

if (manifest.version !== expectedVersion) {
  failures.push(
    `manifest.json version ${manifest.version} must match package.json version ${expectedVersion}.`
  );
}

if (releaseManifest.manifestVersion !== expectedVersion) {
  failures.push(
    `release-manifest.json manifestVersion ${releaseManifest.manifestVersion} must match ${expectedVersion}.`
  );
}
if (releaseManifest.package !== expectedZipName) {
  failures.push(`release-manifest.json package must be ${expectedZipName}.`);
}

const zipFiles = await listFiles(artifactDir, (fileName) =>
  /^cueroom-extension-\d+\.\d+\.\d+\.zip$/.test(fileName)
);
if (zipFiles.length !== 1) {
  failures.push(`Expected exactly one extension ZIP, found ${zipFiles.length}.`);
}
await requireFile(zipPath);

const zipSha256 = await sha256File(zipPath);
const checksum = await readText(path.join(artifactDir, "SHA256SUMS"));
if (checksum !== `${zipSha256}  ${expectedZipName}\n`) {
  failures.push("SHA256SUMS must contain the exact extension ZIP SHA-256 and filename.");
}
if (releaseManifest.packageSha256 !== zipSha256) {
  failures.push("release-manifest.json packageSha256 must match the extension ZIP SHA-256.");
}

for (const requiredFile of [
  "PRIVACY.md",
  "README.md",
  "SHA256SUMS",
  "chrome-web-store-listing.md",
  "chrome-web-store-review.md",
  "manifest-audit.txt",
  "manifest.json",
  "public-beta-checklist.md",
  "release-manifest.json"
]) {
  await requireFile(path.join(artifactDir, requiredFile));
}

await requireCopiedFile("PRIVACY.md", "PRIVACY.md");
await requireCopiedFile("docs/release/chrome-web-store-listing.md", "chrome-web-store-listing.md");
await requireCopiedFile("docs/security/chrome-web-store-review.md", "chrome-web-store-review.md");
await requireCopiedFile("docs/release/public-beta-checklist.md", "public-beta-checklist.md");

const listing = await readText(path.join(artifactDir, "chrome-web-store-listing.md"));
const review = await readText(path.join(artifactDir, "chrome-web-store-review.md"));
const privacy = await readText(path.join(artifactDir, "PRIVACY.md"));

requireText(
  listing,
  "CueRoom is not affiliated with, endorsed by, sponsored by, or approved by Netflix."
);
requireText(
  listing,
  "does not stream Netflix content, capture video/audio, read credentials, read cookies, bypass DRM, or record calls"
);
requireText(
  review,
  "Extension does not read Netflix credentials, cookies, local/session storage, DRM keys, subtitles, frames, screenshots, video, or audio."
);
for (const privacyBoundary of [
  "- [x] No Netflix credentials.",
  "- [x] No Netflix cookies.",
  "- [x] No Netflix account data.",
  "- [x] No Netflix DRM keys.",
  "- [x] No Netflix subtitles.",
  "- [x] No Netflix screenshots, frames, video, or audio."
]) {
  requireText(privacy, privacyBoundary);
}

await requirePngDimensions("images/room-ui-1280x800.png", 1280, 800);
await requirePngDimensions("images/extension-popup-640x400.png", 640, 400);
await requirePngDimensions("images/small-promo-440x280.png", 440, 280);
await requirePngDimensions("images/marquee-promo-1400x560.png", 1400, 560);

if (failures.length > 0) {
  console.error("Chrome Web Store package check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.info(`Chrome Web Store package check passed for ${expectedZipName}.`);

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

async function readText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    failures.push(`Missing readable file: ${path.relative(repoRoot, filePath)}.`);
    return "{}";
  }
}

async function requireFile(filePath) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      failures.push(`Expected file: ${path.relative(repoRoot, filePath)}.`);
    }
  } catch {
    failures.push(`Missing file: ${path.relative(repoRoot, filePath)}.`);
  }
}

async function requireCopiedFile(sourcePath, artifactPath) {
  const source = await readText(path.join(repoRoot, sourcePath));
  const artifact = await readText(path.join(artifactDir, artifactPath));
  if (source !== artifact) {
    failures.push(`${artifactPath} must match ${sourcePath}.`);
  }
}

function requireText(content, expectedText) {
  if (!content.includes(expectedText)) {
    failures.push(`Package evidence must include: ${expectedText}`);
  }
}

async function requirePngDimensions(relativePath, expectedWidth, expectedHeight) {
  const filePath = path.join(artifactDir, relativePath);
  await requireFile(filePath);
  let png;
  try {
    png = await readFile(filePath);
  } catch {
    failures.push(`Missing readable PNG: ${relativePath}.`);
    return;
  }
  const signature = png.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    failures.push(`${relativePath} must be a PNG file.`);
    return;
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    failures.push(
      `${relativePath} must be ${expectedWidth}x${expectedHeight}, found ${width}x${height}.`
    );
  }
}

async function sha256File(filePath) {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

async function listFiles(directory, predicate) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => entry.name);
}
