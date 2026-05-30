import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("./check-github-actions-supply-chain.mjs", import.meta.url)
);
const checkoutSha = "34e114876b0b11c390a56381ad16ebd13914f8d5";
const nodeSha = "49933ea5288caeca8642d1e84afbd3f7d6820020";
const githubScriptSha = "f28e40c7f34bde8b3046d885e986cb6290c5673b";

async function makeFixture(workflows) {
  const root = await mkdtemp(path.join(tmpdir(), "cueroom-actions-"));
  const workflowDir = path.join(root, ".github/workflows");
  await mkdir(workflowDir, { recursive: true });
  for (const [fileName, content] of Object.entries(workflows)) {
    await writeFile(path.join(workflowDir, fileName), content);
  }
  return root;
}

function runCheck(root) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CUEROOM_ACTIONS_ROOT: root
    }
  });
}

test("rejects tag-pinned external actions", async () => {
  const root = await makeFixture({
    "ci.yml": workflow([
      "permissions:",
      "  contents: read",
      "jobs:",
      "  verify:",
      "    steps:",
      "      - uses: actions/checkout@v4"
    ])
  });

  const result = runCheck(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be pinned to a full 40-character commit SHA/);
});

test("rejects unallowlisted actions", async () => {
  const root = await makeFixture({
    "ci.yml": workflow([
      "permissions:",
      "  contents: read",
      "jobs:",
      "  verify:",
      "    steps:",
      `      - uses: evil/action@${checkoutSha}`
    ])
  });

  const result = runCheck(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /action evil\/action is not allowlisted/);
});

test("rejects unexpected write permissions", async () => {
  const root = await makeFixture({
    "ci.yml": workflow([
      "permissions:",
      "  contents: read",
      "jobs:",
      "  verify:",
      "    permissions:",
      "      checks: write",
      "    steps:",
      `      - uses: actions/checkout@${checkoutSha}`
    ])
  });

  const result = runCheck(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /write permission checks is not approved/);
});

test("accepts approved pinned actions and write permission map", async () => {
  const root = await makeFixture({
    "ci.yml": workflow([
      "permissions:",
      "  contents: read",
      "jobs:",
      "  verify:",
      "    steps:",
      `      - uses: actions/checkout@${checkoutSha}`,
      "      - name: Setup Node",
      `        uses: actions/setup-node@${nodeSha}`,
      `      - uses: actions/setup-node@${nodeSha}`
    ]),
    "cleanup.yml": workflow([
      "permissions:",
      "  contents: read",
      "jobs:",
      "  scheduled-generated-prune:",
      "    permissions:",
      "      contents: write",
      "      pull-requests: write",
      "    steps:",
      `      - uses: actions/checkout@${checkoutSha}`,
      `      - uses: actions/github-script@${githubScriptSha}`
    ])
  });

  const result = runCheck(root);
  assert.equal(result.status, 0, result.stderr);
});

test("rejects reviewed actions pinned to an unexpected SHA", async () => {
  const root = await makeFixture({
    "ci.yml": workflow([
      "permissions:",
      "  contents: read",
      "jobs:",
      "  verify:",
      "    steps:",
      "      - uses: actions/checkout@1111111111111111111111111111111111111111"
    ])
  });

  const result = runCheck(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must use reviewed SHA/);
});

function workflow(lines) {
  return `${["name: Test", "on: pull_request", ...lines].join("\n")}\n`;
}
