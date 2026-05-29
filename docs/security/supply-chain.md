# Supply Chain Security

## Required Gates

- [x] Workflow: `.github/workflows/supply-chain.yml`.
- [x] Trigger: pull requests, pushes to `main`, release tags, weekly schedule, and manual dispatch.
- [x] Token scope: `contents: read` only.
- [x] Secret scan: `pnpm security:secrets`.
- [x] License policy: `pnpm security:licenses`.
- [x] Dependency audit: `pnpm security:audit`.
- [x] Release workflow runs `pnpm security:supply-chain` before building release artifacts.

## License Policy

- [x] Allow common permissive and weak-copyleft licenses needed by the current dependency graph.
- [x] Fail on missing license metadata.
- [x] Fail on GPL, LGPL, AGPL, SSPL, BUSL, Commons Clause, CPOL, non-commercial Creative Commons, and `UNLICENSED`.
- [x] Require a code change and `DECISIONS.md` entry before adding a denied or unreviewed license.

## Dependency Audit Policy

- [x] Run `pnpm audit` against the installed workspace.
- [x] Treat any reported vulnerability as a CI failure unless a maintainer records a GHSA-specific exception and rollback trigger.
- [x] Prefer dependency upgrades or pnpm overrides over suppressions.

## Secret Scan Policy

- [x] Scan Git-tracked files only.
- [x] Fail on private key blocks, common SaaS access tokens, CueRoom bearer tokens, and high-entropy secret assignments.
- [x] Keep real secrets in deployment secret stores, never in docs, examples, fixtures, or release artifacts.
