import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const skippedPaths = [
  /^apps\/extension\/dist\//,
  /^artifacts\//,
  /^node_modules\//,
  /^playwright-report\//,
  /^test-results\//
];

const secretPatterns = [
  {
    name: "private key block",
    regex: /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----/g
  },
  {
    name: "GitHub token",
    regex: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g
  },
  {
    name: "AWS access key",
    regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g
  },
  {
    name: "Google API key",
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g
  },
  {
    name: "Slack token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g
  },
  {
    name: "Stripe live secret key",
    regex: /\bsk_live_[0-9A-Za-z]{20,}\b/g
  },
  {
    name: "OpenAI API key",
    regex: /\bsk-(?:proj|svcacct)-[A-Za-z0-9_-]{20,}\b|\bsk-[A-Za-z0-9]{32,}\b/g
  },
  {
    name: "CueRoom bearer token",
    regex: /\b(?:cas|cml|crs)_[A-Za-z0-9_-]{32,}\b/g
  },
  {
    name: "high-entropy secret assignment",
    regex:
      /\b[A-Z0-9_]*(?:PASSWORD|PRIVATE_KEY|SECRET|TOKEN)[A-Z0-9_]*\s*=\s*['"]?[A-Za-z0-9+/=_-]{32,}/g
  }
];

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((filePath) => !skippedPaths.some((pattern) => pattern.test(filePath)));

const findings = [];

for (const filePath of files) {
  const content = readFileSync(filePath);
  if (content.includes(0)) {
    continue;
  }
  const text = content.toString("utf8");
  const lines = text.split("\n");
  for (const [index, line] of lines.entries()) {
    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push(`${filePath}:${index + 1} matched ${pattern.name}`);
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Secret scan failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.info(`Secret scan passed for ${files.length} tracked files.`);
