import { readFile } from "node:fs/promises";
import { auditExtensionManifest } from "../packages/security/dist/index.js";

const manifest = JSON.parse(await readFile("apps/extension/src/manifest.json", "utf8"));
const findings = auditExtensionManifest(manifest);

if (findings.length > 0) {
  console.error("Extension security audit failed:");
  for (const finding of findings) {
    console.error(`- [${finding.severity}] ${finding.message}`);
  }
  process.exit(1);
}

console.info("Extension security audit passed.");
