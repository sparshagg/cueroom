import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { auditExtensionManifest, auditExtensionSource } from "../packages/security/dist/index.js";

const manifest = JSON.parse(await readFile("apps/extension/src/manifest.json", "utf8"));
const sourceFiles = await readExtensionSourceFiles("apps/extension/src");
const findings = [...auditExtensionManifest(manifest), ...auditExtensionSource(sourceFiles)];

if (findings.length > 0) {
  console.error("Extension security audit failed:");
  for (const finding of findings) {
    console.error(`- [${finding.severity}] ${finding.message}`);
  }
  process.exit(1);
}

console.info("Extension security audit passed.");

async function readExtensionSourceFiles(root) {
  const files = [];
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readExtensionSourceFiles(fullPath)));
      continue;
    }

    if (!/\.(?:ts|tsx|js|mjs|html)$/.test(entry.name)) {
      continue;
    }

    files.push({
      path: fullPath,
      content: await readFile(fullPath, "utf8")
    });
  }

  return files;
}
