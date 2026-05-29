# Runbook

## Local Setup

- [ ] Install Node.js 24.14.0 or Node.js 22.13+ and pnpm 10+.
- [ ] Run `nvm use` or `fnm use` from the repo root when your shell supports it.
- [ ] Run `pnpm install`.
- [ ] Copy `.env.example` to `.env`.
- [ ] Run `pnpm dev`.
- [ ] Open web app at `http://localhost:3000`.
- [ ] Open API health at `http://localhost:4000/health`.

## Docker Development

- [ ] Run `docker compose -f infra/docker/compose.dev.yml up --build`.
- [ ] Confirm Postgres, Redis, LiveKit, API, and web containers are healthy.
- [ ] Use local LiveKit keys from `.env.example` only for development.

## Extension Development

- [ ] Run `pnpm --filter @cueroom/extension build`.
- [ ] Open Chrome or Edge extension management.
- [ ] Enable developer mode.
- [ ] Load unpacked extension from `apps/extension/dist`.
- [ ] Confirm the manifest has no forbidden permissions with `pnpm security:extension`.
- [ ] Pair only with `http://localhost:3000` or approved CueRoom origins.

## Release

- [ ] Run `pnpm verify`.
- [ ] Review `LEARNINGS.md` for stale sources.
- [ ] Review `THREAT_MODEL.md` for changed assumptions.
- [ ] Confirm no Netflix sensitive data is logged or stored.
- [ ] Confirm extension permissions did not broaden.
- [ ] Generate changelog from Conventional Commits.
- [ ] Tag release from protected `main`.

## Rollback

- [ ] Identify failing release and last known-good tag.
- [ ] Disable affected deployment route or extension rollout.
- [ ] Rotate LiveKit/API secrets if compromise is suspected.
- [ ] Publish advisory if users are affected.
- [ ] Add postmortem checklist item to `LEARNINGS.md`.

## Secret Leak

- [ ] Revoke the leaked secret immediately.
- [ ] Rotate dependent credentials.
- [ ] Search repository and logs for copies.
- [ ] Force redeploy with new secret.
- [ ] Open a security incident issue with timeline and impact.

## Dependency CVE

- [ ] Confirm affected package and reachable code path.
- [ ] Upgrade or remove dependency.
- [ ] Run tests and security checks.
- [ ] Publish advisory if released users are affected.

## Abuse Report

- [ ] Preserve minimal audit data needed for investigation.
- [ ] Disable offending room or account token.
- [ ] Do not inspect call media; CueRoom does not record it.
- [ ] Respond with actions taken and privacy limits.

## Chrome Web Store Submission

- [ ] Verify minimum permissions.
- [ ] Verify privacy policy and Limited Use disclosure.
- [ ] Verify non-affiliation language.
- [ ] Attach extension zip from CI artifact.
- [ ] Keep rollback package for prior approved version.
