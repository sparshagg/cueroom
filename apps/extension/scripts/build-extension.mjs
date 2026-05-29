import { mkdir, readFile, rm, cp, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { auditExtensionManifest } from "@cueroom/security";

const root = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(root, "..");
const src = path.join(extensionRoot, "src");
const dist = path.join(extensionRoot, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const manifestPath = path.join(src, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const findings = auditExtensionManifest(manifest);
if (findings.length > 0) {
  console.error(findings);
  process.exit(1);
}

await writeFile(path.join(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await cp(path.join(src, "popup.html"), path.join(dist, "popup.html"));
await cp(path.join(src, "popup.css"), path.join(dist, "popup.css"));
await cp(path.join(src, "icons"), path.join(dist, "icons"), { recursive: true });

await build({
  entryPoints: {
    "service-worker": path.join(src, "service-worker.ts"),
    "content-script": path.join(src, "content-script.ts"),
    popup: path.join(src, "popup.ts")
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  outdir: dist,
  sourcemap: false,
  minify: true,
  legalComments: "none"
});
