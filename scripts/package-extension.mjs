import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDist = path.join(repoRoot, "apps/extension/dist");
const artifactDir = path.join(repoRoot, "artifacts/chrome-web-store");

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
run("pnpm", ["--filter", "@cueroom/extension", "build"]);

const manifestPath = path.join(extensionDist, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const version = manifest.version;
const zipName = `cueroom-extension-${version}.zip`;
const zipPath = path.join(artifactDir, zipName);

run("zip", ["-qr", zipPath, "."], { cwd: extensionDist });

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
await writeFile(path.join(artifactDir, "manifest-audit.txt"), auditOutput);
await writeFile(
  path.join(artifactDir, "README.md"),
  [
    "# CueRoom Chrome Web Store Package",
    "",
    `- ZIP: \`${zipName}\``,
    `- Manifest version: \`${version}\``,
    "- Upload the ZIP itself; the manifest is at the ZIP root.",
    "- Use the included privacy policy, listing draft, and review checklist for Developer Dashboard fields."
  ].join("\n") + "\n"
);

console.info(`Chrome Web Store package written to ${zipPath}`);
