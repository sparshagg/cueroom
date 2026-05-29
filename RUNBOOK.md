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
- [ ] Confirm dev ports are bound to `127.0.0.1`, not all host interfaces.
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
- [ ] Confirm Postgres-only sync replay is also rejected across two API store instances when Redis is unavailable.

## Auth Verification

- [ ] Set `AUTH_REQUIRED=true`, `AUTH_RP_ID=localhost`, and `AUTH_ORIGIN=http://localhost:3000` for local auth-gated room creation.
- [ ] Set `AUTH_DEV_MAGIC_LINKS=true` only for local development flows that need returned `devToken` or `devLink` values.
- [ ] Confirm `AUTH_DEV_MAGIC_LINKS=true` is rejected when `NODE_ENV=production`.
- [ ] Run `POSTGRES_TEST_URL=postgres://cueroom:cueroom@localhost:5432/cueroom pnpm --filter @cueroom/api test`.
- [ ] Confirm `auth_sessions` and `magic_links` contain only token hashes, never raw `cas_` or `cml_` tokens.
- [ ] Confirm room sessions use `crs_` tokens and account sessions use `cas_` tokens.
- [ ] Confirm magic-link verification uses `POST /v1/auth/magic-link/verify` with the token in the JSON body, not in a URL path or query string.
- [ ] Confirm production deployments set explicit HTTPS `AUTH_ORIGIN` and domain-only `AUTH_RP_ID`.

## LiveKit Verification

- [ ] Start LiveKit with `docker compose -f infra/docker/compose.dev.yml up -d livekit api web`.
- [ ] Create a room from `http://localhost:3000` and confirm the returned room session is stored in `sessionStorage`, not in the URL.
- [ ] Confirm the web client calls `/v1/livekit/token` only after a valid room session exists.
- [ ] Confirm LiveKit JWTs are not stored in browser storage or printed in logs.
- [ ] Confirm decoded LiveKit grants allow `roomJoin`, camera publish, microphone publish, and subscribe only; data publish, admin, create, list, and record grants must remain disabled.
- [ ] Confirm microphone and camera tracks publish only after explicit user toggle actions.
- [ ] Confirm kick requests close CueRoom realtime sockets and report failure if LiveKit participant removal fails.

## Extension Development

- [ ] Run `pnpm --filter @cueroom/extension build`.
- [ ] Open Chrome or Edge extension management.
- [ ] Enable developer mode.
- [ ] Load unpacked extension from `apps/extension/dist`.
- [ ] Copy the loaded extension ID into `NEXT_PUBLIC_CUEROOM_EXTENSION_ID` or the room page extension ID field.
- [ ] Confirm the manifest has no forbidden permissions with `pnpm security:extension`.
- [ ] Confirm the manifest audit covers `permissions`, `optional_permissions`, `host_permissions`, `optional_host_permissions`, `content_scripts.matches`, content-script file paths, content-script world, CSP, and `externally_connectable.matches`.
- [ ] Pair only with `http://localhost:3000` or approved CueRoom origins.
- [ ] Confirm the extension WebSocket connects to `/v1/rooms/:roomId/realtime` only after a room pairing message.
- [ ] Confirm commands from the web page are relayed to the API and are not applied to Netflix until the API broadcasts `sync.command`.
- [ ] Confirm host playback state produces targeted follower `sync.correction` events for same-title drift.
- [ ] Confirm wrong-title followers receive `sync.warning`, the room UI shows the manual Netflix link, and the extension does not auto-navigate.
- [ ] Confirm guests cannot establish playback authority by sending `sync.state`.

## Release

- [ ] Run `pnpm verify`.
- [ ] Review the latest DAST workflow artifacts and `docs/security/dast.md`.
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
- [ ] For transitive npm CVEs, prefer package-manager overrides only when the parent package has no safe release available and record the rollback trigger in `DECISIONS.md`.
- [ ] Run tests and security checks.
- [ ] Publish advisory if released users are affected.

## Abuse Report

- [ ] Preserve minimal audit data needed for investigation.
- [ ] Disable offending room or account token.
- [ ] Do not inspect call media; CueRoom does not record it.
- [ ] Respond with actions taken and privacy limits.

## Chrome Web Store Submission

- [ ] Verify minimum permissions.
- [ ] Review `docs/security/chrome-web-store-review.md` and the `cueroom-chrome-web-store-review` CI artifact.
- [ ] Verify privacy policy and Limited Use disclosure.
- [ ] Verify non-affiliation language.
- [ ] Attach extension zip from CI artifact.
- [ ] Keep rollback package for prior approved version.
