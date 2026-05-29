import { readFile } from "node:fs/promises";

const learnings = await readFile("LEARNINGS.md", "utf8");
const sourceMatches = [...learnings.matchAll(/^- \[[ x]\] Source:\s*(.+)$/gm)];
const staleByMatches = [...learnings.matchAll(/^\s*- Stale-by:\s*(\d{4}-\d{2}-\d{2})$/gm)];
const today = new Date();
const missingOrInvalid = [];
const stale = [];

for (const [index, match] of sourceMatches.entries()) {
  const nextMatch = sourceMatches[index + 1];
  const block = learnings.slice(match.index, nextMatch?.index);
  if (!/^\s*- Stale-by:\s*\d{4}-\d{2}-\d{2}$/m.test(block)) {
    missingOrInvalid.push(match[1].trim());
  }
}

for (const match of staleByMatches) {
  const date = new Date(`${match[1]}T23:59:59Z`);
  if (date < today) {
    stale.push(match[1]);
  }
}

if (sourceMatches.length === 0) {
  console.error("No learning sources found in LEARNINGS.md.");
  process.exit(1);
}

if (missingOrInvalid.length > 0) {
  console.error(`Learning sources missing valid Stale-by dates: ${missingOrInvalid.join(", ")}`);
  process.exit(1);
}

if (stale.length > 0) {
  console.error(`Stale learning sources found: ${stale.join(", ")}`);
  process.exit(1);
}

console.info(`Docs freshness check passed for ${sourceMatches.length} sources.`);
