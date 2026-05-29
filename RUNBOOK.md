# Runbook

## Local Setup

- [ ] Install Node.js 24.14.0 or Node.js 22.13+ and pnpm 10+.
- [ ] Run `nvm use` or `fnm use` from the repo root when your shell supports it.
- [ ] Run `pnpm install`.
- [ ] Copy `.env.example` to `.env`.
- [ ] Keep `ROOM_STORE=memory` for the fastest local API loop.
- [ ] Run `pnpm dev`.
- [ ] Open web app at `http://localhost:3000`.
- [ ] Open API health at `http://localhost:4000/health`.

## Docker Development

- [ ] Run `docker compose -f infra/docker/compose.dev.yml up --build`.
- [ ] Confirm Postgres, Redis, LiveKit, API, and web containers are healthy.
- [ ] Confirm the API container uses `ROOM_STORE=postgres` and `POSTGRES_URL=postgres://cueroom:cueroom@postgres:5432/cueroom`.
- [ ] Use local LiveKit keys from `.env.example` only for development.

## Postgres Verification

- [ ] Start Postgres with `docker compose -f infra/docker/compose.dev.yml up -d postgres`.
- [ ] Run `POSTGRES_TEST_URL=postgres://cueroom:cueroom@localhost:5432/cueroom pnpm --filter @cueroom/api test`.
- [ ] Confirm session token rows are stored as hashes, not raw `crs_` tokens.

## Redis Verification

- [ ] Start Redis with `docker compose -f infra/docker/compose.dev.yml up -d redis`.
- [ ] Run `REDIS_TEST_URL=redis://localhost:6379/1 pnpm --filter @cueroom/api test`.
- [ ] Run combined state tests with `POSTGRES_TEST_URL=postgres://cueroom:cueroom@localhost:5432/cueroom REDIS_TEST_URL=redis://localhost:6379/1 pnpm --filter @cueroom/api test`.
- [ ] Confirm sync replay is rejected across two API store instances sharing Redis.

## Auth Verification

- [ ] Set `AUTH_REQUIRED=true`, `AUTH_RP_ID=localhost`, and `AUTH_ORIGIN=http://localhost:3000` for local auth-gated room creation.
- [ ] Run `POSTGRES_TEST_URL=postgres://cueroom:cueroom@localhost:5432/cueroom pnpm --filter @cueroom/api test`.
- [ ] Confirm `auth_sessions` and `magic_links` contain only token hashes, never raw `cas_` or `cml_` tokens.
- [ ] Confirm room sessions use `crs_` tokens and account sessions use `cas_` tokens.
- [ ] Confirm magic-link verification uses `POST /v1/auth/magic-link/verify` with the token in the JSON body, not in a URL path or query string.
- [ ] Confirm production deployments set explicit HTTPS `AUTH_ORIGIN` and domain-only `AUTH_RP_ID`.

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
