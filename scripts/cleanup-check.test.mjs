import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./cleanup-check.mjs", import.meta.url));
const diffScriptPath = fileURLToPath(new URL("./check-cleanup-diff.mjs", import.meta.url));

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), "cueroom-cleanup-"));
  await mkdir(path.join(root, "apps/web/src"), { recursive: true });
  await mkdir(path.join(root, "packages/shared/src"), { recursive: true });
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await writeFile(path.join(root, "apps/web/src/page.ts"), "export const page = true;\n");
  await writeFile(path.join(root, "packages/shared/src/index.ts"), "export const ok = true;\n");
  await writeFile(path.join(root, "scripts/check.mjs"), "console.info('ok');\n");
  return root;
}

function runCleanup(root, args = []) {
  return spawnSync(process.execPath, [scriptPath, "--skip-knip", ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CUEROOM_CLEANUP_ROOT: root,
      CUEROOM_CLEANUP_SKIP_KNIP: "1"
    }
  });
}

function runDiffCheck(root) {
  return spawnSync(process.execPath, [diffScriptPath], {
    cwd: root,
    encoding: "utf8"
  });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("prunes untracked generated artifact directories before check mode", async () => {
  const root = await makeFixture();
  const distPath = path.join(root, "apps/web/dist");
  await mkdir(distPath, { recursive: true });
  await writeFile(path.join(distPath, "bundle.js"), "console.info('generated');\n");

  const checkBeforePrune = runCleanup(root);
  assert.notEqual(checkBeforePrune.status, 0);
  assert.match(checkBeforePrune.stderr, /Generated artifact directory should be pruned/);

  const prune = runCleanup(root, ["--prune-generated"]);
  assert.equal(prune.status, 0, prune.stderr);
  assert.match(prune.stdout, /Cleanup prune passed/);
  assert.equal(await exists(distPath), false);

  const checkAfterPrune = runCleanup(root);
  assert.equal(checkAfterPrune.status, 0, checkAfterPrune.stderr);
});

test("does not prune tracked generated artifacts", async () => {
  const root = await makeFixture();
  const distPath = path.join(root, "apps/web/dist");
  await mkdir(distPath, { recursive: true });
  await writeFile(path.join(distPath, "tracked.js"), "console.info('tracked');\n");

  assert.equal(spawnSync("git", ["init"], { cwd: root }).status, 0);
  assert.equal(spawnSync("git", ["add", "apps/web/dist/tracked.js"], { cwd: root }).status, 0);

  const prune = runCleanup(root, ["--prune-generated"]);
  assert.notEqual(prune.status, 0);
  assert.match(prune.stderr, /Tracked generated artifact must be removed in a reviewed PR/);
  assert.equal(await exists(path.join(distPath, "tracked.js")), true);
});

test("prunes tracked generated artifacts only in tracked-prune mode", async () => {
  const root = await makeFixture();
  const distPath = path.join(root, "apps/web/dist");
  await mkdir(distPath, { recursive: true });
  await writeFile(path.join(distPath, "tracked.js"), "console.info('tracked');\n");

  assert.equal(spawnSync("git", ["init"], { cwd: root }).status, 0);
  assert.equal(spawnSync("git", ["add", "apps/web/dist/tracked.js"], { cwd: root }).status, 0);

  const prune = runCleanup(root, ["--prune-generated", "--prune-tracked-generated"]);
  assert.equal(prune.status, 0, prune.stderr);
  assert.equal(await exists(path.join(distPath, "tracked.js")), false);
});

test("checks root docs and config files for stale cleanup candidates", async () => {
  const root = await makeFixture();
  await writeFile(path.join(root, "README.md"), "");
  await writeFile(path.join(root, "AGENTS.md.tmp"), "temporary\n");

  const result = runCleanup(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Empty source\/doc\/config file: README.md/);
  assert.match(result.stderr, /Temporary file should be removed: AGENTS.md.tmp/);
});

test("accepts only generated cleanup diffs", async () => {
  const root = await makeFixture();
  const distPath = path.join(root, "apps/web/dist");
  await mkdir(distPath, { recursive: true });
  await writeFile(path.join(distPath, "tracked.js"), "console.info('tracked');\n");

  assert.equal(spawnSync("git", ["init"], { cwd: root }).status, 0);
  assert.equal(spawnSync("git", ["add", "apps/web/dist/tracked.js"], { cwd: root }).status, 0);

  const prune = runCleanup(root, ["--prune-generated", "--prune-tracked-generated"]);
  assert.equal(prune.status, 0, prune.stderr);

  const generatedOnly = runDiffCheck(root);
  assert.equal(generatedOnly.status, 0, generatedOnly.stderr);
});

test("rejects source cleanup diffs", async () => {
  const root = await makeFixture();

  assert.equal(spawnSync("git", ["init"], { cwd: root }).status, 0);
  assert.equal(spawnSync("git", ["add", "apps/web/src/page.ts"], { cwd: root }).status, 0);
  await writeFile(path.join(root, "apps/web/src/page.ts"), "export const changed = true;\n");

  const result = runDiffCheck(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cleanup diff contains non-generated paths/);
  assert.match(result.stderr, /apps\/web\/src\/page.ts/);
});

test("rejects staged source cleanup diffs", async () => {
  const root = await makeFixture();

  assert.equal(spawnSync("git", ["init"], { cwd: root }).status, 0);
  assert.equal(spawnSync("git", ["add", "apps/web/src/page.ts"], { cwd: root }).status, 0);
  await writeFile(path.join(root, "apps/web/src/page.ts"), "export const staged = true;\n");
  assert.equal(spawnSync("git", ["add", "apps/web/src/page.ts"], { cwd: root }).status, 0);

  const result = runDiffCheck(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Cleanup diff contains non-generated paths/);
  assert.match(result.stderr, /apps\/web\/src\/page.ts/);
});
