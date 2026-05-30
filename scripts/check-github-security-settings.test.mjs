import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptPath = fileURLToPath(new URL("./check-github-security-settings.mjs", import.meta.url));

test("accepts enabled GitHub security settings", () => {
  const result = runCheck({
    privateVulnerabilityReporting: { enabled: true },
    repository: repositoryFixture()
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /GitHub security settings check passed/);
});

test("rejects disabled private vulnerability reporting", () => {
  const result = runCheck({
    privateVulnerabilityReporting: { enabled: false },
    repository: repositoryFixture()
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /private vulnerability reporting must be enabled/i);
});

test("rejects disabled repository security features", () => {
  const result = runCheck({
    privateVulnerabilityReporting: { enabled: true },
    repository: repositoryFixture({
      dependabot_security_updates: { status: "disabled" },
      secret_scanning_push_protection: { status: "disabled" }
    })
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Dependabot security updates must be enabled/);
  assert.match(result.stderr, /secret scanning push protection must be enabled/);
});

test("accepts maintainer watch verification when requested", () => {
  const result = runCheck(
    {
      privateVulnerabilityReporting: { enabled: true },
      repository: repositoryFixture(),
      subscription: { subscribed: true, ignored: false }
    },
    ["--require-watch"]
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /including maintainer watch status/);
});

test("rejects ignored repository subscription when watch verification is requested", () => {
  const result = runCheck(
    {
      privateVulnerabilityReporting: { enabled: true },
      repository: repositoryFixture(),
      subscription: { subscribed: true, ignored: true }
    },
    ["--require-watch"]
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must watch the repository and must not ignore it/);
});

function runCheck(fixtures, args = []) {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "cueroom-github-security-"));
  try {
    writeJson(
      fixtureDir,
      "private-vulnerability-reporting",
      fixtures.privateVulnerabilityReporting
    );
    writeJson(fixtureDir, "repository", fixtures.repository);
    if (fixtures.subscription) {
      writeJson(fixtureDir, "subscription", fixtures.subscription);
    }

    return spawnSync(process.execPath, [scriptPath, "--repo", "sparshagg/cueroom", ...args], {
      encoding: "utf8",
      env: {
        ...process.env,
        CUEROOM_GITHUB_SECURITY_FIXTURE_DIR: fixtureDir
      }
    });
  } finally {
    rmSync(fixtureDir, { force: true, recursive: true });
  }
}

function writeJson(fixtureDir, name, value) {
  writeFileSync(path.join(fixtureDir, `${name}.json`), `${JSON.stringify(value)}\n`);
}

function repositoryFixture(overrides = {}) {
  return {
    security_and_analysis: {
      dependabot_security_updates: { status: "enabled" },
      secret_scanning: { status: "enabled" },
      secret_scanning_push_protection: { status: "enabled" },
      ...overrides
    }
  };
}
