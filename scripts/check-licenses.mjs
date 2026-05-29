import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const allowedLicenseTokens = new Set([
  "0BSD",
  "Apache-2.0",
  "Artistic-2.0",
  "BlueOak-1.0.0",
  "BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-3.0",
  "CC0-1.0",
  "ISC",
  "MIT",
  "MPL-2.0",
  "Python-2.0",
  "Unicode-3.0",
  "Unicode-DFS-2016",
  "Unlicense",
  "W3C",
  "Zlib"
]);

const deniedLicensePatterns = [
  /\bAGPL\b/i,
  /\bBUSL\b/i,
  /\bCC-BY-NC\b/i,
  /Commons Clause/i,
  /\bCPOL\b/i,
  /\bGPL\b/i,
  /\bLGPL\b/i,
  /\bSSPL\b/i,
  /\bUNLICENSED\b/i
];

const packageTree = JSON.parse(
  execFileSync("pnpm", ["list", "--json", "--depth", "Infinity"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  })
);
const packages = collectPackagePaths(packageTree);
const failures = [];
let checkedPackages = 0;

for (const packagePath of packages) {
  const manifestPath = path.join(packagePath, "package.json");
  if (!existsSync(manifestPath)) {
    continue;
  }
  checkedPackages += 1;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const license = normalizeLicense(manifest.license ?? manifest.licenses);
  const label = `${manifest.name}@${manifest.version}`;

  if (!license) {
    failures.push(`${label} has no declared license`);
    continue;
  }

  if (deniedLicensePatterns.some((pattern) => pattern.test(license))) {
    failures.push(`${label} uses denied license expression: ${license}`);
    continue;
  }

  const tokens = new Set(license.match(/[A-Za-z0-9-.+]+/g) ?? []);
  if (![...tokens].some((token) => allowedLicenseTokens.has(token))) {
    failures.push(`${label} uses unreviewed license expression: ${license}`);
  }
}

if (failures.length > 0) {
  console.error("License policy check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.info(`License policy check passed for ${checkedPackages} installed packages.`);

function collectPackagePaths(nodes, packagePaths = new Set()) {
  for (const node of nodes) {
    collectDependencyGroup(node.dependencies, packagePaths);
    collectDependencyGroup(node.devDependencies, packagePaths);
    collectDependencyGroup(node.optionalDependencies, packagePaths);
  }
  return packagePaths;
}

function collectDependencyGroup(dependencies, packagePaths) {
  if (!dependencies) {
    return;
  }
  for (const dependency of Object.values(dependencies)) {
    if (!dependency.path || packagePaths.has(dependency.path)) {
      continue;
    }
    packagePaths.add(dependency.path);
    collectDependencyGroup(dependency.dependencies, packagePaths);
    collectDependencyGroup(dependency.devDependencies, packagePaths);
    collectDependencyGroup(dependency.optionalDependencies, packagePaths);
  }
}

function normalizeLicense(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (Array.isArray(value)) {
    return value.map(normalizeLicense).filter(Boolean).join(" OR ");
  }
  if (typeof value === "object" && typeof value.type === "string") {
    return value.type.trim();
  }
  return "";
}
