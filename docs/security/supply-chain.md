# Supply Chain Security

## Required Gates

- [x] Workflow: `.github/workflows/supply-chain.yml`.
- [x] Trigger: pull requests, pushes to `main`, release tags, weekly schedule, and manual dispatch.
- [x] Supply-chain workflow token scope: `contents: read` only.
- [x] Secret scan: `pnpm security:secrets`.
- [x] License policy: `pnpm security:licenses`.
- [x] Dependency audit: `pnpm security:audit`.
- [x] GitHub Actions policy: `pnpm security:actions`.
- [x] GitHub repository security settings evidence: `pnpm security:github`.
- [x] External workflow actions are pinned to reviewed full-length commit SHAs and restricted to an explicit allowlist.
- [x] Workflow write permissions are restricted to approved workflow/job grants for release publishing, CodeQL upload, and generated-cleanup automation.
- [x] Release workflow runs `pnpm security:supply-chain` before building release artifacts.
- [x] Release readiness check fails if the release workflow drops checksum verification, artifact upload, attestation, or prerelease attachment steps.
- [x] Release workflow keeps install, test, build, package, and artifact upload steps in a read-only `build-package` job.
- [x] Release workflow uses write/OIDC scopes only in the `publish-prerelease` job that verifies the downloaded artifact, attests it, and creates the prerelease.

## License Policy

- [x] Allow common permissive and weak-copyleft licenses needed by the current dependency graph.
- [x] Fail on missing license metadata.
- [x] Fail on GPL, LGPL, AGPL, SSPL, BUSL, Commons Clause, CPOL, non-commercial Creative Commons, and `UNLICENSED`.
- [x] Require a code change and `DECISIONS.md` entry before adding a denied or unreviewed license.

## Dependency Audit Policy

- [x] Run `pnpm audit` against the installed workspace.
- [x] Treat any reported vulnerability as a CI failure unless a maintainer records a GHSA-specific exception and rollback trigger.
- [x] Prefer dependency upgrades or pnpm overrides over suppressions.

## GitHub Security Settings Policy

- [x] Verify private vulnerability reporting is enabled before public beta.
- [x] Verify Dependabot security updates are enabled before public beta.
- [x] Verify secret scanning and push protection are enabled before public beta.
- [x] Verify maintainer repository watch status with `pnpm security:github -- --require-watch` after refreshing the GitHub CLI `notifications` scope.

## Secret Scan Policy

- [x] Scan Git-tracked files only.
- [x] Fail on private key blocks, common SaaS access tokens, CueRoom bearer tokens, and high-entropy secret assignments.
- [x] Keep real secrets in deployment secret stores, never in docs, examples, fixtures, or release artifacts.
