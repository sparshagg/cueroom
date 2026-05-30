# Runbook

## Local Setup

- [ ] Install Node.js 24.14.0 or Node.js 22.13+ and pnpm 10+.
- [ ] Run `nvm use` or `fnm use` from the repo root when your shell supports it.
- [ ] Run `pnpm install`.
- [ ] Run `pnpm exec playwright install chromium` before local `pnpm verify` or visual checks.
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

## Docker Production

- [ ] Copy `infra/docker/.env.prod.example` to `infra/docker/.env.prod` and set real `CUEROOM_DOMAIN`, `CUEROOM_API_DOMAIN`, `CUEROOM_LIVEKIT_DOMAIN`, `ACME_EMAIL`, `LIVEKIT_API_KEY`, SMTP, and extension ID values.
- [ ] Create the secret files listed in `infra/docker/secrets/README.md`, including separate Redis password and Redis URL files.
- [ ] Copy `infra/docker/livekit/livekit.prod.example.yaml` to `infra/docker/secrets/livekit.yaml` and set the same LiveKit API secret recorded in `infra/docker/secrets/livekit_api_secret` plus the same Redis password recorded in `infra/docker/secrets/redis_password`.
- [ ] Confirm DNS for `CUEROOM_DOMAIN`, `CUEROOM_API_DOMAIN`, and `CUEROOM_LIVEKIT_DOMAIN` points to the deployment host before starting Caddy.
- [ ] Firewall matrix: TCP 80 reaches Caddy for ACME HTTP validation and HTTP-to-HTTPS handling.
- [ ] Firewall matrix: TCP 443 reaches Caddy for web, API, and LiveKit signaling HTTPS/WSS routes.
- [ ] Firewall matrix: TCP 7881 reaches LiveKit for ICE/TCP fallback.
- [ ] Firewall matrix: UDP 50000-60000 reaches LiveKit for ICE/UDP media.
- [ ] Firewall matrix: optional UDP 3478 and TCP 5349 or TCP 443 reach LiveKit TURN only when the deployment enables embedded TURN.
- [ ] Confirm the default compose stack is direct ICE only; do not claim corporate-firewall/VPN compatibility until TURN is enabled and tested.
- [ ] Choose a LiveKit TURN strategy before public beta; if enabling embedded TURN, provision a dedicated TURN domain, trusted certificate files, and firewall rules for the selected TURN/TLS and TURN/UDP ports.
- [ ] Run `pnpm docker:prod-check`.
- [ ] Run `docker compose --env-file infra/docker/.env.prod -f infra/docker/compose.prod.yml config` and confirm no plaintext secret values are printed.
- [ ] Run `docker compose --env-file infra/docker/.env.prod -f infra/docker/compose.prod.yml up -d --build`.
- [ ] Confirm Postgres, Redis, API, web, LiveKit, and Caddy containers are running.
- [ ] Confirm Postgres, Redis, API, and web do not publish host ports in the production compose output.
- [ ] Confirm Redis requires authentication by running `docker compose --env-file infra/docker/.env.prod -f infra/docker/compose.prod.yml exec redis redis-cli ping` and expecting `NOAUTH`.
- [ ] Confirm Redis authentication works by running `docker compose --env-file infra/docker/.env.prod -f infra/docker/compose.prod.yml exec redis sh -c 'REDISCLI_AUTH="$(cat /run/secrets/redis_password)" redis-cli ping'`.
- [ ] Confirm Redis, API, and web containers pass health checks while running with dropped Linux capabilities and `no-new-privileges`; confirm API and web run as non-root users.
- [ ] Confirm `https://$CUEROOM_DOMAIN/privacy` renders the in-app privacy policy before entering the Chrome Web Store privacy policy URL.

## Postgres Verification

- [ ] Start Postgres with `docker compose -f infra/docker/compose.dev.yml up -d postgres`.
- [ ] Run `POSTGRES_TEST_URL=postgres://cueroom:cueroom@localhost:5432/cueroom pnpm --filter @cueroom/api test`.
- [ ] Confirm session token rows are stored as hashes, not raw `crs_` tokens.
- [ ] Confirm concurrent API test workers can run migrations without deadlocks.

## Redis Verification

- [ ] Start Redis with `docker compose -f infra/docker/compose.dev.yml up -d redis`.
- [ ] Run `REDIS_TEST_URL=redis://localhost:6379/1 pnpm --filter @cueroom/api test`.
- [ ] Run combined state tests with `POSTGRES_TEST_URL=postgres://cueroom:cueroom@localhost:5432/cueroom REDIS_TEST_URL=redis://localhost:6379/1 pnpm --filter @cueroom/api test`.
- [ ] Confirm sync replay is rejected across two API store instances sharing Redis.
- [ ] Confirm Postgres-only sync replay is also rejected across two API store instances when Redis is unavailable.

## Cleanup Verification

- [ ] Run `pnpm cleanup:check` for read-only unused file, export, dependency, temporary-file, and generated-artifact detection.
- [ ] Run `pnpm cleanup:prune` to remove untracked generated artifacts such as `.next`, `.turbo`, `dist`, `build`, `coverage`, `artifacts`, `playwright-report`, `test-results`, `.DS_Store`, and `*.tsbuildinfo`.
- [ ] Run `pnpm cleanup:test` after cleanup script or workflow changes.
- [ ] Run `pnpm cleanup:diff-check` before committing any cleanup branch and confirm the diff is generated-only when using the automated generated-artifact cleanup path.
- [ ] For source cleanup candidates, open a reviewed PR with tests; do not silently delete protected-branch source.
- [ ] Confirm the scheduled Cleanup Review workflow keeps pull-request cleanup checks read-only and grants `contents: write` plus `pull-requests: write` only to the generated-artifact prune job.

## Auth Verification

- [ ] Set `AUTH_REQUIRED=true`, `AUTH_RP_ID=localhost`, and `AUTH_ORIGIN=http://localhost:3000` for local auth-gated room creation.
- [ ] Set `AUTH_DEV_MAGIC_LINKS=true` only for local development flows that need returned `devToken` or `devLink` values.
- [ ] Confirm `AUTH_DEV_MAGIC_LINKS=true` is rejected when `NODE_ENV=production`.
- [ ] For production magic links, set `SMTP_HOST`, `SMTP_FROM`, and provider credentials through secrets; set `SMTP_PORT=465` with `SMTP_SECURE=true` or require STARTTLS with `SMTP_REQUIRE_TLS=true`.
- [ ] Confirm production startup fails when SMTP delivery is not configured.
- [ ] Confirm production `SMTP_HOST` is a hostname, not an IP literal.
- [ ] Run `POSTGRES_TEST_URL=postgres://cueroom:cueroom@localhost:5432/cueroom pnpm --filter @cueroom/api test`.
- [ ] Confirm `auth_sessions` and `magic_links` contain only token hashes, never raw `cas_` or `cml_` tokens.
- [ ] Confirm room sessions use `crs_` tokens and account sessions use `cas_` tokens.
- [ ] Confirm magic-link verification uses `POST /v1/auth/magic-link/verify` with the token in the JSON body, not in a URL path or query string.
- [ ] Confirm magic-link email URLs use `/auth/magic-link#token=...` fragments, not query strings.
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
- [ ] Confirm `pnpm security:extension` also rejects extension source use of remote-code primitives, forbidden Chrome APIs, browser cookie/storage reads, subtitle/track inspection, and media/frame capture APIs.
- [ ] Confirm the manifest audit covers `permissions`, `optional_permissions`, `host_permissions`, `optional_host_permissions`, `content_scripts.matches`, content-script file paths, content-script world, CSP, and `externally_connectable.matches`.
- [ ] Pair only with `http://localhost:3000` or approved CueRoom origins.
- [ ] Confirm the extension WebSocket connects to `/v1/rooms/:roomId/realtime` only after a room pairing message.
- [ ] Confirm commands from the web page are relayed to the API and are not applied to Netflix until the API broadcasts `sync.command`.
- [ ] Confirm host `sync.command` events include a target watch ID and the extension skips commands when the active Netflix watch ID differs.
- [ ] Confirm host playback state produces targeted follower `sync.correction` events for same-title drift.
- [ ] Confirm wrong-title followers receive `sync.warning`, the room UI shows the manual Netflix link, and the extension does not auto-navigate.
- [ ] Confirm guests cannot establish playback authority by sending `sync.state`.

## Release

- [ ] Run `pnpm security:github` and confirm GitHub private vulnerability reporting, Dependabot security updates, secret scanning, and push protection are enabled.
- [ ] If repo watch verification is needed, refresh GitHub CLI with `gh auth refresh -h github.com -s notifications`, then run `pnpm security:github -- --require-watch`.
- [ ] Run `pnpm verify`.
- [ ] Run `pnpm security:supply-chain`.
- [ ] Run `pnpm security:actions` and confirm every external GitHub Action is allowlisted, full-SHA pinned, and uses only approved workflow/job write grants.
- [ ] Run `pnpm security:api-rate-limits` and confirm room/session authorization routes keep route-level limits.
- [ ] Run `pnpm release:check -- --tag v0.1.0` and confirm versions, release files, and checklist files are present.
- [ ] Confirm `pnpm release:check -- --tag v0.1.0` also validates the release workflow's checksum, attestation, prerelease, and required attachment steps.
- [ ] Review the `cueroom-visual-regression` CI artifact for home, room, and extension popup screenshots.
- [ ] Run `pnpm extension:package`.
- [ ] Run `cd artifacts/chrome-web-store && shasum -a 256 -c SHA256SUMS`.
- [ ] Review the latest DAST workflow artifacts and `docs/security/dast.md`.
- [ ] Confirm `cueroom-dast-authenticated-flow` proves `POST /v1/auth/magic-link/request`, `POST /v1/auth/magic-link/verify`, `POST /v1/rooms`, `POST /v1/rooms/join`, and `POST /v1/rooms/:roomId/report` were observed through ZAP with redacted artifacts.
- [ ] Review `LEARNINGS.md` for stale sources.
- [ ] Review `THREAT_MODEL.md` for changed assumptions.
- [ ] Review `docs/release/public-beta-checklist.md` and leave any incomplete blocker unchecked.
- [ ] Run `pnpm docs:freshness` and confirm it passes privacy parity checks for `PRIVACY.md`, `/privacy`, and Chrome Web Store privacy answers.
- [ ] Confirm `pnpm docs:freshness` also passes legal-copy checks for non-affiliation and no Netflix streaming, redistribution, recording, or DRM-bypass claims across README, web UI, extension, and store listing sources.
- [ ] Confirm `pnpm docs:freshness` also passes public-origin checks for `apps/extension/src/manifest.json`, `docs/release/chrome-web-store-listing.md`, `infra/docker/.env.prod.example`, and `docs/release/public-beta-checklist.md`.
- [ ] Run `pnpm privacy:evidence` and review `docs/release/privacy-implementation-evidence.md` before legal/privacy sign-off.
- [ ] Confirm the deployed web app renders `/privacy`, links it from the home page, and matches `PRIVACY.md` before entering the hosted privacy URL in external dashboards.
- [ ] Review `docs/release/legal-privacy-review.md` and confirm real reviewer, review date, review scope, public beta domain, hosted privacy policy URL, and Chrome Web Store developer owner evidence is recorded before tagging.
- [ ] Confirm `pnpm release:check -- --tag v0.1.0 --require-beta-gates` fails while legal/privacy evidence is unchecked or placeholder-only, and passes only after real evidence is recorded.
- [ ] Confirm no Netflix sensitive data is logged or stored.
- [ ] Confirm extension permissions did not broaden.
- [ ] Confirm `artifacts/chrome-web-store` contains a versioned extension ZIP, `SHA256SUMS`, `release-manifest.json`, manifest, manifest audit, privacy policy, listing draft, and review checklist.
- [ ] Confirm `artifacts/chrome-web-store/images` contains room, popup, small promo, and marquee promo PNG assets.
- [ ] Run `pnpm release:notes -- --tag v0.1.0 --output artifacts/release-notes/v0.1.0.md`.
- [ ] Review generated release notes for user-facing accuracy, legal/privacy blockers, and no Netflix-affiliation language.
- [ ] Merge the release PR into protected `main` only after required checks and review pass.
- [ ] From protected `main`, run `git tag -s v0.1.0 -m "CueRoom v0.1.0"` when a signing key is available.
- [ ] If signing is not available, document the reason and use an annotated tag with a rollback trigger in `DECISIONS.md`.
- [ ] Run `git verify-tag v0.1.0` for signed tags.
- [ ] Push the release tag with `git push origin v0.1.0`.
- [ ] Confirm the release workflow runs `pnpm release:check -- --require-annotated-tag --require-main --require-beta-gates`.
- [ ] Confirm the release workflow keeps package build/test steps in the read-only `build-package` job and restricts release/attestation scopes to `publish-prerelease`.
- [ ] Confirm the release workflow attaches `release-notes.md` and uses it as the GitHub prerelease body.
- [ ] Download the release artifact and run `gh attestation verify cueroom-extension-0.1.0.zip --repo sparshagg/cueroom --signer-workflow sparshagg/cueroom/.github/workflows/release.yml --source-ref refs/tags/v0.1.0`.
- [ ] Confirm the GitHub prerelease includes the extension ZIP, `SHA256SUMS`, and `release-manifest.json`.

## Rollback

- [ ] Identify failing release and last known-good tag.
- [ ] Disable affected deployment route or extension rollout.
- [ ] Rotate LiveKit/API secrets if compromise is suspected.
- [ ] Publish advisory if users are affected.
- [ ] Add postmortem checklist item to `LEARNINGS.md`.

## Secret Leak

- [ ] Follow `docs/security/incident-response.md`.
- [ ] Revoke the leaked secret immediately.
- [ ] Rotate dependent credentials.
- [ ] Search repository and logs for copies.
- [ ] Force redeploy with new secret.
- [ ] Open a security incident issue with timeline and impact.

## Dependency CVE

- [ ] Follow `docs/security/incident-response.md` if released users may be affected.
- [ ] Run `pnpm security:audit` and preserve the failing advisory output privately when exploit details are sensitive.
- [ ] Confirm affected package and reachable code path.
- [ ] Upgrade or remove dependency.
- [ ] For transitive npm CVEs, prefer package-manager overrides only when the parent package has no safe release available and record the rollback trigger in `DECISIONS.md`.
- [ ] Run tests and security checks.
- [ ] Publish advisory if released users are affected.

## Abuse Report

- [ ] For in-room reports, look up the `report_` ID in `room_reports` and preserve only the report metadata needed for action.
- [ ] Use `.github/ISSUE_TEMPLATE/abuse_report.md` only for non-sensitive reports.
- [ ] Move reports containing exploit detail, invite tokens, account tokens, or secrets into private security handling.
- [ ] Preserve minimal audit data needed for investigation.
- [ ] Disable offending room or account token.
- [ ] Do not inspect call media; CueRoom does not record it.
- [ ] Respond with actions taken and privacy limits.

## Chrome Web Store Submission

- [ ] Run `pnpm extension:package`.
- [ ] Confirm the release workflow and `docs/security/supply-chain.md` checks are green for the exact tag or commit.
- [ ] Verify `SHA256SUMS` and `release-manifest.json` in `artifacts/chrome-web-store`.
- [ ] Confirm `images/room-ui-1280x800.png`, `images/extension-popup-640x400.png`, `images/small-promo-440x280.png`, and `images/marquee-promo-1400x560.png` are present in the package evidence.
- [ ] Verify minimum permissions.
- [ ] Review `docs/security/chrome-web-store-review.md` and the `cueroom-chrome-web-store-review` CI artifact.
- [ ] Verify `PRIVACY.md` and Limited Use disclosure match Chrome Web Store privacy form answers.
- [ ] Enter the deployed `/privacy` URL as the Chrome Web Store privacy policy URL.
- [ ] Verify `docs/release/chrome-web-store-privacy-answers.md` matches the Developer Dashboard Privacy practices answers.
- [ ] Verify `docs/release/chrome-web-store-listing.md` matches the current manifest and release package.
- [ ] Verify non-affiliation language.
- [ ] Attach versioned extension zip from `artifacts/chrome-web-store` or CI artifact.
- [ ] Keep rollback package for prior approved version.
