import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const fixtureDir = process.env.CUEROOM_GITHUB_SECURITY_FIXTURE_DIR;
const failures = [];
const args = parseArgs(process.argv.slice(2));

const privateVulnerabilityReporting = readGitHubJson(
  "private-vulnerability-reporting",
  `repos/${args.repo}/private-vulnerability-reporting`
);
const repository = readGitHubJson("repository", `repos/${args.repo}`);

if (privateVulnerabilityReporting.enabled !== true) {
  failures.push("GitHub private vulnerability reporting must be enabled.");
}

const securityAndAnalysis = repository.security_and_analysis ?? {};
for (const [setting, description] of [
  ["dependabot_security_updates", "Dependabot security updates"],
  ["secret_scanning", "secret scanning"],
  ["secret_scanning_push_protection", "secret scanning push protection"]
]) {
  if (securityAndAnalysis[setting]?.status !== "enabled") {
    failures.push(`${description} must be enabled.`);
  }
}

if (args.requireWatch) {
  const subscription = readGitHubJson("subscription", `repos/${args.repo}/subscription`, {
    optionalScopeHint:
      "Run `gh auth refresh -h github.com -s notifications`, then rerun with --require-watch."
  });

  if (subscription.subscribed !== true || subscription.ignored === true) {
    failures.push("The authenticated maintainer must watch the repository and must not ignore it.");
  }
}

if (failures.length > 0) {
  console.error("GitHub security settings check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

const watchNote = args.requireWatch ? " including maintainer watch status" : "";
console.info(`GitHub security settings check passed for ${args.repo}${watchNote}.`);

function parseArgs(rawArgs) {
  const parsed = {
    repo: "sparshagg/cueroom",
    requireWatch: false
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--repo") {
      parsed.repo = rawArgs[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--require-watch") {
      parsed.requireWatch = true;
      continue;
    }
    failures.push(`Unknown GitHub security check argument: ${arg}`);
  }

  if (!/^[\w.-]+\/[\w.-]+$/.test(parsed.repo)) {
    failures.push(`GitHub repository must use owner/name format: ${parsed.repo}`);
  }

  return parsed;
}

function readGitHubJson(fixtureName, endpoint, options = {}) {
  if (fixtureDir) {
    return JSON.parse(readFileSync(path.join(fixtureDir, `${fixtureName}.json`), "utf8"));
  }

  const result = spawnSync("gh", ["api", endpoint], {
    encoding: "utf8"
  });

  if (result.error) {
    failures.push(`Failed to run GitHub CLI for ${endpoint}: ${result.error.message}`);
    return {};
  }

  if (result.status !== 0) {
    const details = `${result.stderr}${result.stdout}`.trim();
    const suffix = options.optionalScopeHint ? ` ${options.optionalScopeHint}` : "";
    failures.push(
      `GitHub API request failed for ${endpoint}.${suffix}${details ? ` ${details}` : ""}`
    );
    return {};
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    failures.push(`GitHub API returned invalid JSON for ${endpoint}: ${error.message}`);
    return {};
  }
}
