import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("apps/extension/src/manifest.json", "utf8"));
const forbidden = new Set([
  "cookies",
  "webRequest",
  "webRequestBlocking",
  "debugger",
  "tabCapture",
  "desktopCapture"
]);
const findings = [];

for (const permission of manifest.permissions ?? []) {
  if (forbidden.has(permission)) {
    findings.push(`Forbidden permission: ${permission}`);
  }
}

for (const host of manifest.host_permissions ?? []) {
  if (host === "<all_urls>" || host === "*://*/*") {
    findings.push("Broad host permission is forbidden");
  }
  if (!host.includes("netflix.com")) {
    findings.push(`Unexpected host permission: ${host}`);
  }
}

const csp = manifest.content_security_policy?.extension_pages ?? "";
if (/unsafe-eval|https?:/.test(csp)) {
  findings.push("Extension CSP must not allow remote scripts or unsafe-eval");
}

const manifestText = JSON.stringify(manifest);
for (const forbiddenText of ["cookies", "webRequest", "debugger", "<all_urls>", "unsafe-eval"]) {
  if (
    manifestText.includes(forbiddenText) &&
    !["cookies", "webRequest", "debugger"].every((text) => forbiddenText !== text)
  ) {
    findings.push(`Forbidden manifest text detected: ${forbiddenText}`);
  }
}

if (findings.length > 0) {
  console.error("Extension security audit failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.info("Extension security audit passed.");
