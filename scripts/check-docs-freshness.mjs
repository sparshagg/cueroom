import { readFile } from "node:fs/promises";

const learnings = await readFile("LEARNINGS.md", "utf8");
const staleByMatches = [...learnings.matchAll(/Stale-by:\s*(\d{4}-\d{2}-\d{2})/g)];
const today = new Date();
const stale = [];

for (const match of staleByMatches) {
  const date = new Date(`${match[1]}T23:59:59Z`);
  if (date < today) {
    stale.push(match[1]);
  }
}

if (stale.length > 0) {
  console.error(`Stale learning sources found: ${stale.join(", ")}`);
  process.exit(1);
}

console.info(`Docs freshness check passed for ${staleByMatches.length} sources.`);
