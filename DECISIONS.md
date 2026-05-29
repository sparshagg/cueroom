# Decisions

## ADR-001: Product Name

- [x] Problem: Choose a name that does not imply Netflix affiliation.
- [x] Options: CueRoom, SyncLounge, WatchWire, TandemWatch.
- [x] Decision: Use CueRoom.
- [x] Reason: Short, social, media-adjacent, and avoids Netflix marks.
- [x] Security/privacy impact: Reduces trademark and user-confusion risk.
- [x] Rollback trigger: Trademark conflict or strong existing product conflict.

## ADR-002: Netflix Integration Boundary

- [x] Problem: Decide whether CueRoom streams Netflix content or syncs local sessions.
- [x] Options: Stream/proxy content, official partner integration, local-session companion extension.
- [x] Decision: Use local-session companion extension only.
- [x] Reason: Avoids DRM bypass, credential handling, and redistribution risk.
- [x] Security/privacy impact: Greatly reduces sensitive-data and legal exposure.
- [x] Rollback trigger: Legal review blocks content-script integration.

## ADR-003: Realtime Calls

- [x] Problem: Choose video call transport.
- [x] Options: Hand-rolled WebRTC mesh, LiveKit self-hosting, managed SaaS.
- [x] Decision: Use self-hosted LiveKit.
- [x] Reason: Open-source, Docker-friendly, mature media server and token model.
- [x] Security/privacy impact: Media transport is isolated and token-scoped.
- [x] Rollback trigger: Operational complexity exceeds project capacity.

## ADR-004: Repository Shape

- [x] Problem: Choose structure for web, API, extension, packages, and infra.
- [x] Options: single app, separate repos, pnpm monorepo.
- [x] Decision: pnpm monorepo.
- [x] Reason: Shared contracts and security checks stay versioned together.
- [x] Security/privacy impact: Shared validation reduces trust-boundary drift.
- [x] Rollback trigger: Release cadence requires independent versioning.

## ADR-005: Cleanup Automation

- [x] Problem: Delete unused code automatically without breaking protected branches.
- [x] Options: silent deletion, detection-only, auto PR with tests.
- [x] Decision: Detect unused source and fail/report; generated artifacts may be cleaned locally.
- [x] Reason: Silent source deletion is unsafe in open-source projects.
- [x] Security/privacy impact: Reduces supply-chain and availability risk.
- [x] Rollback trigger: Maintainers opt into trusted auto-PR infrastructure.

## ADR-006: Room Persistence Boundary

- [x] Problem: Make room membership and sessions survive API restarts without persisting chat, call media, or watch history.
- [x] Options: keep in-memory only, persist all room state in Postgres, split durable metadata in Postgres and ephemeral presence/sync in Redis.
- [x] Decision: Persist rooms, participants, and hashed session tokens in Postgres; keep presence, rate limits, and sync counters ephemeral until the Redis slice.
- [x] Reason: Durable authorization state is needed before real calls and extension sync can be trusted across restarts.
- [x] Security/privacy impact: Session tokens are stored as SHA-256 hashes only; CueRoom still does not persist chat, media, credentials, cookies, DRM data, subtitles, screenshots, or Netflix streams.
- [x] Rollback trigger: Operational review finds Postgres too heavy for the beta path or a managed auth/database service is selected.

## ADR-007: Redis Ephemeral State

- [x] Problem: Avoid process-local rate limits, invite cache, advisory presence, and sync replay counters in a horizontally scaled API.
- [x] Options: keep all ephemeral state in memory, move all state to Postgres, use Redis for volatile state while Postgres remains authoritative.
- [x] Decision: Use Redis for rate limits, invite indexes, advisory presence, and sync sequence counters; never use Redis as durable membership or session authority.
- [x] Reason: Redis gives fast expiring keys and atomic counter semantics without widening persisted privacy scope.
- [x] Security/privacy impact: Sync replay protection fails closed when Redis is configured but unavailable; invite and presence keys are best-effort cache/advisory data and are rechecked against Postgres.
- [x] Rollback trigger: Redis operational failures block beta stability or a managed realtime/presence service replaces it.

## ADR-008: Host Account Auth

- [x] Problem: Hosts need abuse-resistant sign-in before creating production rooms without mixing account sessions and room sessions.
- [x] Options: no accounts, password auth, magic-link only, passkeys with magic-link bootstrap.
- [x] Decision: Use Postgres-backed accounts, hashed account sessions, one-time hashed magic links, and WebAuthn passkeys with explicit RP ID/origin config.
- [x] Reason: Passkeys avoid password storage while magic links provide a practical bootstrap path for early open-source testing.
- [x] Security/privacy impact: Account tokens use a distinct `cas_` prefix, room tokens keep the `crs_` prefix, magic links are body-verified and single-use, and authenticated room creation links rooms to account IDs when `AUTH_REQUIRED=true`.
- [x] Rollback trigger: Email delivery/recovery requirements or browser compatibility force a managed auth provider.

## ADR-009: LiveKit Client Integration

- [x] Problem: Connect the custom CueRoom room UI to LiveKit without letting media tokens bypass CueRoom authorization.
- [x] Options: LiveKit prefab UI, LiveKit React components with custom skin, lower-level `livekit-client` room lifecycle.
- [x] Decision: Use `livekit-client` directly for M3 and keep CueRoom's custom Tailwind room UI.
- [x] Reason: Direct room lifecycle control is the smallest durable change and avoids importing prefab UI assumptions while the room/session bridge is still maturing.
- [x] Security/privacy impact: LiveKit JWTs stay in memory, room sessions stay in `sessionStorage`, token minting is rate-limited, data publishing is disabled, and publish sources are limited to camera and microphone.
- [x] Rollback trigger: Connect/disconnect races or media rendering complexity require adopting official React room hooks/components.

## ADR-010: Playback Realtime Authority

- [x] Problem: Connect the extension to live room sync without letting a trusted web origin bypass server role and replay checks.
- [x] Options: direct website-to-extension commands, REST polling, authenticated API WebSocket with server-broadcast room events.
- [x] Decision: Use an authenticated API WebSocket; the extension forwards playback state and applies only server-broadcast commands.
- [x] Reason: A single room channel gives low-latency sync while keeping command authority at the API.
- [x] Security/privacy impact: Room tokens are sent only inside the first WebSocket auth message, commands pass through room membership/role/replay validation, and the extension no longer directly applies website-originated commands.
- [x] Rollback trigger: Service-worker WebSocket lifecycle proves unreliable and requires a different realtime transport.

## ADR-011: Drift Correction Authority

- [x] Problem: Keep followers synced without letting local extension logic invent playback commands or mutate the wrong Netflix title.
- [x] Options: extension-local drift correction, reuse `sync.command`, API-targeted `sync.correction` and `sync.warning` events.
- [x] Decision: API stores ephemeral host playback authority and sends targeted correction/warning events to followers.
- [x] Reason: Drift policy belongs at the same authorization boundary as room membership, while warnings can be shown without opening a second room socket from the web app.
- [x] Security/privacy impact: Guests cannot establish playback authority, corrections include the expected watch ID, the content script refuses mismatched watch IDs, and wrong-title states produce warnings instead of automatic navigation.
- [x] Rollback trigger: Multi-process realtime scaling requires moving host authority from process memory to Redis pub/sub/state.

## ADR-012: DAST Baseline

- [x] Problem: Add dynamic security evidence without making local development depend on a slow scanner.
- [x] Options: run ZAP inside `pnpm verify`, run a separate ZAP workflow, defer DAST until beta.
- [x] Decision: Add a separate GitHub Actions ZAP baseline workflow with artifacts and non-blocking findings for first triage.
- [x] Reason: The scanner needs a running web/API pair and produces evidence better suited to CI artifacts than local source checks.
- [x] Security/privacy impact: Web security headers are set before scanning; DAST artifacts become part of the release review path.
- [x] Rollback trigger: Baseline findings are triaged and the workflow can be promoted to fail on medium/high alerts.

## ADR-013: Independent Security Review Hardening

- [x] Problem: Close security-review gaps without widening CueRoom's Netflix, media, or account data boundaries.
- [x] Options: defer findings to beta, patch only tests/docs, or land source-level controls with focused regression coverage.
- [x] Decision: Land source-level controls for extension audits, realtime session rechecks, WebSocket rate limits, LiveKit kick failure reporting, Postgres sync replay persistence, Docker loopback ports, and opt-in dev magic links.
- [x] Reason: These controls are small, local, and reduce production footguns before public beta.
- [x] Security/privacy impact: Reduces token disclosure risk, stale realtime authorization, replay acceptance across API instances, broad extension-permission drift, unintended dev service exposure, and silent media-removal failure.
- [x] Rollback trigger: Operational testing shows the controls break supported local development or require a different auth/realtime architecture.

## ADR-014: PostCSS CVE Override

- [x] Problem: GitHub Dependabot reported CVE-2026-41305 / GHSA-qx2v-qp2m-jg93 for a transitive `postcss` version below 8.5.10.
- [x] Options: wait for upstream framework release, add a root pnpm override, or remove the dependent framework.
- [x] Decision: Add a root workspace override forcing `postcss` to the patched 8.5.x line.
- [x] Reason: The vulnerable version is transitive through the web framework, while pnpm overrides are the smallest repo-local control until upstream dependency metadata catches up.
- [x] Security/privacy impact: Removes a known CSS stringification XSS advisory from the installed graph without changing CueRoom's runtime data boundaries.
- [x] Rollback trigger: Upstream framework releases a compatible dependency update that resolves to patched `postcss` without an override.

## ADR-015: Chrome Web Store Beta Package

- [x] Problem: Public beta needs repeatable extension packaging and privacy/listing evidence instead of hand-built ZIP files.
- [x] Options: keep CI inline packaging, add a dedicated packaging script, or publish manually from `apps/extension/dist`.
- [x] Decision: Add `pnpm extension:package` to build the extension, create a versioned ZIP, and copy review evidence into `artifacts/chrome-web-store`.
- [x] Reason: A single local/CI command reduces release drift and keeps the uploaded ZIP, manifest audit, privacy policy, and listing draft together.
- [x] Security/privacy impact: Store submissions carry explicit least-permission, non-affiliation, no-sensitive-Netflix-data, and Limited Use evidence.
- [x] Rollback trigger: Chrome Web Store API automation replaces manual artifact upload and produces equivalent evidence.

## ADR-016: Magic-Link Email Delivery

- [x] Problem: Production auth cannot rely on returned development magic-link tokens.
- [x] Options: keep dev-only token disclosure, add provider-specific email API, add generic SMTP delivery through Nodemailer.
- [x] Decision: Use a generic SMTP mailer for magic-link delivery and keep dev token disclosure opt-in/local only.
- [x] Reason: SMTP works across common self-hosted and managed email providers without coupling CueRoom to one vendor.
- [x] Security/privacy impact: `cml_` tokens are stored hashed server-side, sent only in email link fragments, posted back in JSON bodies, never returned in production responses, and production auth-required deployments fail closed without SMTP config.
- [x] Rollback trigger: Deliverability or abuse controls require a managed email provider integration.

## ADR-017: Release Provenance And Public Beta Response

- [x] Problem: Public beta needs repeatable release evidence, artifact provenance, and a concrete sensitive-report path before users install the extension.
- [x] Options: manual ZIP upload only, CI-built prereleases with checksums, or full Chrome Web Store API publishing.
- [x] Decision: Use a tag-triggered GitHub prerelease workflow that verifies beta gates, builds the extension package, checks `SHA256SUMS`, uploads release metadata, and creates a GitHub artifact attestation.
- [x] Reason: This is the smallest self-hostable path that proves what source produced the extension ZIP while the first Chrome Web Store submission remains a manual dashboard step.
- [x] Security/privacy impact: Release tags must come from protected `main`, beta blockers stay explicit, sensitive security reports route through private vulnerability reporting, and public abuse reports are constrained to non-sensitive metadata.
- [x] Rollback trigger: Chrome Web Store API automation or a dedicated release manager replaces manual dashboard upload and produces equal or stronger provenance evidence.

## ADR-018: Supply Chain Gates

- [x] Problem: The public beta needs CI evidence for dependency vulnerabilities, license compatibility, and accidental secret commits without adding a heavyweight third-party service.
- [x] Options: rely on GitHub alerts only, add third-party scanners, or add repo-owned scripts plus `pnpm audit`.
- [x] Decision: Add a dedicated supply-chain workflow using `pnpm security:secrets`, `pnpm security:licenses`, and `pnpm security:audit`.
- [x] Reason: Repo-owned secret and license checks are reviewable and deterministic, while `pnpm audit` uses the package manager's advisory flow for installed dependencies.
- [x] Security/privacy impact: Release artifacts are gated on no known dependency vulnerabilities, no denied licenses, and no high-confidence leaked secrets in tracked source.
- [x] Rollback trigger: A maintained first-party GitHub or pnpm supply-chain gate replaces these scripts with equal or stronger evidence.

## ADR-019: Room Participant Abuse Reports

- [x] Problem: Public beta needs an in-product report-user path without collecting Netflix content, call media, credentials, or private room links.
- [x] Options: GitHub issue template only, room-scoped report endpoint, or full moderation console.
- [x] Decision: Add a room-scoped participant report endpoint and compact room UI action backed by authenticated room sessions.
- [x] Reason: This gives maintainers actionable room/participant metadata for beta abuse triage without building a broad moderation system before launch.
- [x] Security/privacy impact: Reports reject unauthenticated sessions, self-reports, unknown participant IDs, and oversized details; API responses and logs omit free-text details by default.
- [x] Rollback trigger: Legal/privacy review requires a different retention model or a dedicated abuse operations backend.

## ADR-020: Authenticated Room-Session DAST Flow

- [x] Problem: The ZAP baseline scan did not prove room-session paths for room creation, joining, and report-user submission were exercised before public beta.
- [x] Options: API-only smoke, Playwright smoke without ZAP, ZAP Automation Framework full auth plan, or browser-driven smoke proxied through a local ZAP daemon.
- [x] Decision: Run a Playwright browser flow through a local ZAP daemon before the existing baseline action, then upload sanitized ZAP evidence.
- [x] Reason: The browser flow exercises the real UI and room-session API contract without introducing a test-only auth bypass or changing the production app.
- [x] Security/privacy impact: Authenticated DAST artifacts redact room/session/invite/report identifiers and do not upload raw proxy traffic, Netflix traffic, LiveKit media, or extension traffic.
- [x] Rollback trigger: ZAP Automation Framework replaces the custom daemon/export flow with equivalent authenticated coverage and redaction guarantees.

## ADR-021: Deterministic Release Notes

- [x] Problem: The beta runbook required a changelog, but the release workflow only delegated notes to GitHub's generated release-note service.
- [x] Options: keep GitHub generated notes only, adopt a third-party changelog package, or add a repo-owned Conventional Commits release-note generator.
- [x] Decision: Add `pnpm release:notes` and use its generated `release-notes.md` as the prerelease body and attached release asset.
- [x] Reason: A repo-owned script keeps release copy deterministic, reviewable in local beta gates, and aligned with CueRoom's Conventional Commit policy without adding a dependency.
- [x] Security/privacy impact: The release body carries explicit publisher checks for legal/privacy gates, extension provenance, and non-affiliation language before users install the extension.
- [x] Rollback trigger: GitHub generated notes or a maintained changelog tool is configured to produce equivalent reviewed output with the same privacy and non-affiliation checks.

## ADR-022: Serialized Postgres Migrations

- [x] Problem: Parallel API test workers can run idempotent migrations against the same local Postgres database and deadlock on schema locks.
- [x] Options: disable parallel tests, retry deadlocked migrations, create per-worker databases, or serialize migrations with a Postgres advisory transaction lock.
- [x] Decision: `runPostgresMigrations` takes a stable transaction-level advisory lock before applying migration SQL.
- [x] Reason: The lock is a small production-safe guard that keeps migrations idempotent while preserving parallel test execution and startup behavior.
- [x] Security/privacy impact: Reduces deployment and CI reliability risk without changing stored data, token handling, extension permissions, or CueRoom's Netflix data boundary.
- [x] Rollback trigger: A dedicated migration tool replaces the current runner and provides equivalent distributed migration locking.

## ADR-023: Web/API Security Headers

- [x] Problem: Latest DAST evidence reported missing web CSP headers and missing API `X-Content-Type-Options`.
- [x] Options: accept the scanner findings for beta, add a proxy-only header runbook, or set application-owned headers in Next.js and Fastify.
- [x] Decision: Set a source-limiting web CSP through `next.config.ts` and add API `X-Content-Type-Options: nosniff` through a Fastify request hook.
- [x] Reason: Application-owned headers keep local, CI, Docker, and production behavior aligned without depending on a specific edge proxy.
- [x] Security/privacy impact: Reduces XSS, clickjacking, object embedding, and MIME-sniffing risk without changing CueRoom's no-Netflix-media/no-credentials data boundary.
- [x] Rollback trigger: A deployment edge policy or nonce-based CSP replaces these app-level defaults with equal or stronger coverage.
- [x] Superseded scope: ADR-024 replaces the static web CSP portion with a nonce-based CSP; the API `nosniff` hook remains current.

## ADR-024: Nonce-Based Web CSP

- [x] Problem: Authenticated DAST confirmed the static web CSP exists but still reports medium-risk findings for `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'`.
- [x] Options: accept the findings for beta, switch to experimental SRI, or use the documented Next.js App Router nonce flow through `proxy.ts` plus dynamic rendering.
- [x] Decision: Generate a per-request nonce in `apps/web/src/proxy.ts`, set the CSP on the request and response, and opt CueRoom pages into dynamic rendering with `connection()`.
- [x] Reason: The nonce path closes inline-script/style findings without relying on experimental SRI and keeps the production policy independent of a hosting edge proxy.
- [x] Security/privacy impact: Removes production `unsafe-inline` from web CSP while preserving the existing no-Netflix-media/no-credentials data boundary.
- [x] Rollback trigger: Next.js nonce handling regresses or a stable SRI path gives equivalent CSP strictness with lower rendering cost.

## ADR-025: Postgres Migration Journal

- [x] Problem: Parallel Postgres tests can deadlock when one worker replays idempotent DDL after another worker has already migrated and started exercising DML.
- [x] Options: force serial API tests, add broad advisory locks around test DML, or record applied migration files and skip already-applied DDL under the existing migration advisory lock.
- [x] Decision: Add a `schema_migrations` table managed by `runPostgresMigrations` and execute only migration files that are not recorded.
- [x] Reason: A migration journal is the smallest production-relevant fix: it preserves parallel tests, keeps startup idempotent, and avoids replaying table-altering DDL on every pool initialization.
- [x] Security/privacy impact: Reduces deployment/test reliability risk without changing auth tokens, room data, extension permissions, or CueRoom's Netflix data boundary.
- [x] Rollback trigger: CueRoom adopts an external migration tool with an equivalent applied-migration ledger and locking behavior.

## ADR-026: Authenticated DAST Blocking Gate

- [x] Problem: DAST artifacts were reviewed manually, but medium/high ZAP alerts were not yet a blocking CI condition.
- [x] Options: keep manual artifact review only, rely on the generic ZAP baseline action, or add a CueRoom-specific evidence gate over sanitized authenticated-flow artifacts.
- [x] Decision: Add `pnpm dast:check-zap-evidence` to fail CI when authenticated ZAP coverage is incomplete, raw proxy traffic is uploaded, or web/API alerts reach `Medium` or higher.
- [x] Reason: CueRoom's authenticated browser flow is the meaningful beta security surface, and a repo-owned gate can enforce coverage and redaction rules that the generic baseline action does not know.
- [x] Security/privacy impact: Prevents regressions in authenticated create/join/report flows without uploading raw proxy traffic or exposing room/session/report identifiers.
- [x] Rollback trigger: A managed DAST service replaces this workflow and enforces equivalent coverage, redaction, and medium/high failure behavior.

## ADR-027: Deterministic Extension ZIP Packaging

- [x] Problem: Re-running `pnpm extension:package` changed the extension ZIP SHA because rebuilt files carried fresh timestamps.
- [x] Options: accept per-run hashes, record only CI artifact IDs, or normalize package timestamps and zip a sorted file list.
- [x] Decision: Normalize extension build output mtimes to a fixed timestamp and create the ZIP from a sorted file list with extra ZIP metadata disabled.
- [x] Reason: A deterministic ZIP gives maintainers a stable `SHA256SUMS` value for the same source tree and makes package review reproducible.
- [x] Security/privacy impact: Reduces release substitution and review drift risk without changing extension runtime permissions or data access.
- [x] Rollback trigger: CI artifact attestations become the sole release integrity source and make local deterministic ZIP hashes redundant.

## ADR-028: Release Workflow Integrity Gate

- [x] Problem: The release workflow produced checksums, release notes, GitHub artifacts, attestations, and a prerelease, but `pnpm release:check` did not fail if a future edit removed those provenance-critical steps.
- [x] Options: rely on code review, add a YAML linter dependency, or add repo-owned workflow invariant checks to the existing release readiness script.
- [x] Decision: Extend `pnpm release:check` to assert the release workflow trigger, permissions, ordered supply-chain/check/package/checksum/attestation/prerelease steps, and required release attachments.
- [x] Reason: A small repo-owned gate keeps the beta release path auditable without adding another parser dependency or network-dependent check.
- [x] Security/privacy impact: Reduces the chance of shipping an extension ZIP without checksum verification, artifact provenance, reviewed release notes, or tag/main beta gates.
- [x] Rollback trigger: A maintained workflow policy engine replaces these string invariants with equal or stronger release-provenance enforcement.

## ADR-029: Release Permission Split

- [x] Problem: The release workflow previously ran dependency install, Playwright setup, supply-chain checks, verification, and packaging with the same token scopes needed to create releases and attest artifacts.
- [x] Options: keep one job, split build and publish jobs, or move publishing to a manual maintainer workstation.
- [x] Decision: Use a read-only `build-package` job for install/test/package/upload, then a write-scoped `publish-prerelease` job that downloads the artifact, rechecks checksums, attests the exact ZIP, and creates the prerelease.
- [x] Reason: Job-level permissions are the smallest workflow-native boundary that reduces release-token exposure without losing automated provenance.
- [x] Security/privacy impact: Compromised install/build/test steps no longer receive `contents: write`, `attestations: write`, or `id-token: write`; the publish job revalidates the package before attestation.
- [x] Rollback trigger: GitHub adds step-level permissions or a trusted reusable release workflow replaces the two-job boundary.

## ADR-030: Chrome Web Store Package Evidence Gate

- [x] Problem: Chrome Web Store review evidence was generated by `pnpm extension:package`, but CI did not independently assert the ZIP checksum, copied review docs, generated image dimensions, and privacy-boundary statements before upload.
- [x] Options: rely on package script success, add manual checklist review only, or add a repo-owned package evidence checker.
- [x] Decision: Add `pnpm store:check-package` and run it after package generation in CI and release workflows, plus after artifact download before attestation.
- [x] Reason: A deterministic checker catches missing or stale review artifacts before maintainers upload the extension to the store.
- [x] Security/privacy impact: Store review packages must carry non-affiliation text, no-sensitive-Netflix-data claims, exact checksums, matching source docs, and generated promo/screenshot assets.
- [x] Rollback trigger: Chrome Web Store API publishing with first-party validation replaces the local evidence package.

## ADR-031: Scanner-Safe CSP Nonce Encoding

- [x] Problem: ZAP can misclassify hex CSP nonces as payment-card PII when a random nonce contains a long decimal digit run.
- [x] Options: accept the false positive, suppress ZAP PII findings globally, or change nonce encoding and reject scanner-sensitive digit runs.
- [x] Decision: Generate CSP nonces as base64url values and retry when the value contains an eight-or-more digit run.
- [x] Reason: The nonce stays random and CSP-compatible while avoiding a noisy DAST false positive without weakening the PII gate.
- [x] Security/privacy impact: Keeps nonce-based CSP enforcement and preserves DAST blocking for real PII disclosures.
- [x] Rollback trigger: ZAP PII detection no longer flags nonce-like values or the CSP runtime rejects base64url nonces.

## ADR-032: Chrome Web Store Privacy Answers Source

- [x] Problem: The project had privacy policy and listing drafts, but the Chrome Web Store dashboard privacy answers were only summarized, making dashboard drift harder to catch before submission.
- [x] Options: leave answers in release notes, add a dedicated answer source, or wait for manual dashboard entry.
- [x] Decision: Add `docs/release/chrome-web-store-privacy-answers.md`, copy it into store package evidence, and make `pnpm store:check-package` verify key privacy-answer claims.
- [x] Reason: A dedicated source file lets legal/privacy reviewers compare dashboard answers against implementation and `PRIVACY.md` without relying on memory.
- [x] Security/privacy impact: Reduces risk of Chrome Web Store privacy disclosure drift for website content access, auth data, transient chat, Limited Use, and no Netflix sensitive-data collection.
- [x] Rollback trigger: Chrome Web Store API automation replaces the manual dashboard answer source with generated submission data.

## ADR-033: Source-Of-Truth Stale Language Gate

- [x] Problem: `README.md` and `AGENTS.md` still described completed beta surfaces as skeletons or stubs, which could mislead contributors and agents.
- [x] Options: manually update docs only, add a broad prose linter, or extend the existing docs freshness check with a narrow stale-language guard.
- [x] Decision: Update the source-of-truth docs and fail `pnpm docs:freshness` when `README.md` or `AGENTS.md` reintroduce scaffold terms for implemented surfaces.
- [x] Reason: A narrow repo-owned guard prevents obvious stale beta-readiness language without adding another dependency.
- [x] Security/privacy impact: Keeps contributor instructions aligned with the implemented auth, extension, sync, and release boundaries instead of implying unfinished placeholders.
- [x] Rollback trigger: A maintained documentation policy tool replaces the custom stale-language check.

## ADR-034: Hosted Privacy Policy Route

- [x] Problem: Public beta and Chrome Web Store submission require a live privacy policy URL, but the web app did not yet expose the policy at a first-party route.
- [x] Options: rely on repository `PRIVACY.md`, host a separate static document, or add a first-party `/privacy` route linked from the home page.
- [x] Decision: Add `/privacy` to the web app, link it from the home page, and cover the route in Playwright visual/security-boundary checks plus docs freshness drift checks.
- [x] Reason: A first-party route gives maintainers the eventual `https://cueroom.app/privacy` URL without adding another hosting surface or external document workflow.
- [x] Security/privacy impact: Makes the Limited Use disclosure one click from the home page and locks the no-sensitive-Netflix-data boundary into UI and docs freshness coverage.
- [x] Rollback trigger: A managed legal/privacy portal becomes the authoritative hosted policy and is linked from the home page and Chrome Web Store dashboard.

## ADR-035: Production Compose Secrets Boundary

- [x] Problem: The repo had a loopback-bound development compose stack, but public beta needs a separate production self-hosting path with TLS routing and without plaintext secrets in compose.
- [x] Options: document provider-specific deploy steps only, reuse the dev compose stack with production env values, or add a dedicated production compose/Caddy/secrets workflow.
- [x] Decision: Add `infra/docker/compose.prod.yml`, `Caddyfile.prod`, secret-file scaffolding, API `*_FILE` loading, production runtime guards, non-root app containers, and `pnpm docker:prod-check`.
- [x] Reason: A dedicated production stack keeps dev shortcuts out of public deployments while staying self-hostable and reviewable in source.
- [x] Security/privacy impact: Postgres, Redis, API, and web stay off public host ports; Caddy owns HTTPS entry points; API secrets are read from Docker secret files; LiveKit production config is mounted as a secret file; production rejects memory room storage and localhost CSP connect sources.
- [x] Rollback trigger: A managed deployment platform replaces compose and provides equivalent secret mounting, TLS, LiveKit media port, and no-public-database controls.

## ADR-036: Production Redis Auth And LiveKit TURN Stance

- [x] Problem: Production Redis was internal-only but unauthenticated, and LiveKit TURN was only generally mentioned rather than tied to a deployer-owned public beta decision.
- [x] Options: keep Redis unauthenticated on the private Compose network, require Redis auth through Docker secrets, or replace Redis with a managed provider immediately.
- [x] Decision: Require Redis auth in production compose with secret-backed `redis_password`, `redis.conf`, and `redis_url` files, pass the same password into LiveKit config, and keep default production compose on direct ICE only until a deployer explicitly enables embedded TURN with a dedicated TURN domain/cert/firewall plan.
- [x] Reason: Internal networks reduce exposure but are not a sufficient secret boundary; secret-backed Redis auth is a small permanent hardening step while keeping self-hosting simple.
- [x] Security/privacy impact: Redis-backed presence, rate limits, invites, and sync counters require credentials; API and LiveKit no longer assume unauthenticated Redis; default self-hosting documents direct ICE connectivity limits so restrictive-network support is not accidentally claimed without certificates/firewall coverage.
- [x] Rollback trigger: A managed Redis/LiveKit platform provides equivalent authenticated Redis, firewall, and TURN/TLS controls with documented operational ownership.

## ADR-037: Legal And Privacy Evidence Release Gate

- [x] Problem: The public beta checklist requires human legal/privacy review, but a future release could accidentally check the beta gates without recording concrete reviewer, scope, date, domain, and Chrome Web Store owner evidence.
- [x] Options: rely on maintainer discipline, require a separate legal tool, or extend the repo-owned release readiness gate to validate local evidence fields.
- [x] Decision: Add checked evidence fields to `docs/release/legal-privacy-review.md` and make `pnpm release:check -- --require-beta-gates` reject unchecked or placeholder values plus unchecked legal/privacy checklist items.
- [x] Reason: This preserves the human-review boundary while making checkbox-only beta sign-off fail before tagging.
- [x] Security/privacy impact: Reduces the chance of publishing a beta with unreviewed non-affiliation language, mismatched privacy disclosures, or missing hosted policy ownership evidence.
- [x] Rollback trigger: A maintained release governance system records equivalent reviewer, domain, and privacy-dashboard evidence before release tags are accepted.

## ADR-038: Privacy Disclosure Parity Guard

- [x] Problem: `PRIVACY.md`, the in-app `/privacy` route, and the Chrome Web Store privacy answers could drift while still leaving the human privacy-review checkbox unchecked until late in release.
- [x] Options: rely on legal review only, copy all policy text manually into every surface, or add source-level parity checks for the high-risk disclosure claims.
- [x] Decision: Extend `pnpm docs:freshness` to check policy checklist items on the `/privacy` route and to require Chrome Web Store answer coverage for handled data, no-sensitive-Netflix-data exclusions, no-sale/no-ads claims, transient chat, abuse-report metadata, and Limited Use.
- [x] Reason: A source-level guard catches local disclosure drift before package generation while still leaving external dashboard and human review as explicit blockers.
- [x] Security/privacy impact: Reduces risk of inconsistent privacy disclosures for Chrome Web Store users without broadening data collection or extension permissions.
- [x] Rollback trigger: Chrome Web Store API submission automation generates privacy answers directly from a typed privacy manifest with equivalent source and route checks.

## ADR-039: Legal Copy Drift Guard

- [x] Problem: User-facing CueRoom copy could drift into missing non-affiliation language or positive Netflix streaming/redistribution/bypass claims before human legal review.
- [x] Options: rely on manual review, keep a static checklist only, or add narrow source checks for required legal boundary copy.
- [x] Decision: Extend `pnpm docs:freshness` to require non-affiliation and negative Netflix content-boundary copy in README, Chrome Web Store listing, web UI, privacy route, extension popup, and manifest sources, and to flag likely positive Netflix content claims.
- [x] Reason: This catches obvious legal-copy regressions early while preserving qualified human legal review as the release blocker.
- [x] Security/privacy impact: Reduces user-confusion and content-handling risk without changing runtime data collection, sync behavior, or extension permissions.
- [x] Rollback trigger: A dedicated legal-copy policy checker replaces the repo-owned regex guard with equal or stronger surface coverage.

## ADR-040: Public Origin Consistency Guard

- [x] Problem: The public beta domain in extension `externally_connectable.matches` could drift from Chrome Web Store listing docs, production domain examples, or release checklist language.
- [x] Options: rely on release review, duplicate the domain manually in more docs, or add a source-level consistency check around the manifest's public origin.
- [x] Decision: Extend `pnpm docs:freshness` to parse the extension manifest, require exactly one public HTTPS CueRoom origin, and verify that origin against the store listing, production `.env` example, and public-beta checklist.
- [x] Reason: The manifest is the security-sensitive source for website-to-extension reachability, so documentation and deployment examples should align with it before beta packaging.
- [x] Security/privacy impact: Reduces risk of publishing a store listing or production config that points users to an origin not authorized for extension pairing.
- [x] Rollback trigger: A typed deployment manifest becomes the single source for public domains and generates extension, docs, and production env examples.

## ADR-041: Privacy Implementation Evidence Guard

- [x] Problem: The legal/privacy checklist named implementation claims, but reviewers had to manually infer the source files, tests, and commands behind each claim.
- [x] Options: leave evidence in reviewer notes, add a prose-only evidence appendix, or add a checked evidence index with source/test/command anchors.
- [x] Decision: Add `docs/release/privacy-implementation-evidence.md` and `pnpm privacy:evidence` to verify every core privacy claim has referenced source files, checks, commands, and source-code anchors.
- [x] Reason: Release privacy review should be repeatable and inspectable without treating unchecked human sign-off as complete.
- [x] Security/privacy impact: Reduces risk that privacy disclosures drift from implementation for transient chat, abuse reports, hashed tokens, magic links, LiveKit tokens, and Netflix sensitive-data exclusions.
- [x] Rollback trigger: A stronger generated privacy-control matrix replaces the hand-authored evidence index and validates the same or broader claims.

## ADR-042: API Room Route Rate-Limit Guard

- [x] Problem: Room and session endpoints perform authorization and abuse-sensitive actions, but some route handlers relied only on the broad global API rate limit.
- [x] Options: keep only the global limiter, add ad hoc limits to a few endpoints, or require explicit route-level limits for every room/session authorization route.
- [x] Decision: Add named route-level `config.rateLimit` objects for room creation, room joins, room reads, room controls, HTTP sync commands, reports, LiveKit token minting, and realtime handshakes; enforce them with `pnpm security:api-rate-limits`.
- [x] Reason: Explicit per-route limits document the threat model and make future regressions visible in local verification and CI.
- [x] Security/privacy impact: Reduces brute-force, invite guessing, token guessing, room-control abuse, and realtime handshake pressure before requests reach sensitive room/session authorization logic.
- [x] Rollback trigger: A centralized typed route registry replaces source-text guarding while proving the same route coverage.

## ADR-043: Extension Source Sensitive-API Audit

- [x] Problem: The extension gate audited the manifest boundary, but did not inspect packaged extension source for remote-code execution primitives or APIs that could collect Netflix-sensitive data.
- [x] Options: rely on manifest permissions only, add manual Chrome Web Store review notes, or make `pnpm security:extension` scan extension source for narrow forbidden patterns.
- [x] Decision: Extend the shared security package with `auditExtensionSource` and run it from `scripts/audit-extension.mjs` over extension TypeScript, JavaScript, and HTML sources.
- [x] Reason: Chrome Web Store review and MV3 security both care about source behavior, not only manifest permissions; a narrow source audit catches high-risk drift before packaging.
- [x] Security/privacy impact: Reduces risk of accidentally adding remote code execution, forbidden Chrome APIs, cookie/storage reads, subtitle/track inspection, screenshots, or media capture to the Netflix content boundary.
- [x] Rollback trigger: A stronger AST-based extension source scanner replaces the regex guard while proving the same or broader forbidden-behavior coverage.

## ADR-044: Account-Authenticated DAST Flow

- [x] Problem: The ZAP-authenticated browser flow exercised room-session create/join/report behavior with `AUTH_REQUIRED=false`, leaving the production account-session room-creation path to API tests and manual release review.
- [x] Options: keep API-only auth coverage, add a separate DAST job for auth, or extend the existing DAST browser flow with a magic-link sign-in prelude.
- [x] Decision: Run the DAST app with `AUTH_REQUIRED=true` and `AUTH_DEV_MAGIC_LINKS=true`, then have `scripts/dast-authenticated-flows.mjs` sign in through the UI before creating the room; exported ZAP evidence requires the magic-link request and verify endpoints when `DAST_REQUIRE_ACCOUNT_AUTH_ZAP=true`.
- [x] Reason: This keeps the DAST surface close to the real browser workflow while avoiding real SMTP secrets or external identity providers in CI.
- [x] Security/privacy impact: Increases confidence that account-session authorization, redaction, and ZAP coverage work together for production-style room creation without uploading raw proxy traffic or real magic-link delivery artifacts.
- [x] Rollback trigger: A dedicated production-staging DAST environment with real email test inboxes replaces dev magic links and proves equivalent auth-required coverage.

## ADR-045: Watch-ID-Targeted Host Commands

- [x] Problem: Host `sync.command` events could be role-authorized and replay-protected while still lacking the target Netflix watch ID needed for the extension to refuse playback mutation on the wrong title.
- [x] Options: keep command payloads untargeted, make `watchId` optional during rollout, or require `watchId` and reject legacy commands without a target.
- [x] Decision: Require `watchId` in `syncCommandSchema`, preserve it through API/realtime broadcasts, and have the Netflix content script return `{ ok: false }` without touching playback when the active watch ID differs.
- [x] Reason: Host commands and drift corrections should use the same wrong-title safety boundary; rejecting untargeted legacy commands is safer than preserving an ambiguous mutation path.
- [x] Security/privacy impact: Reduces risk that a valid room command pauses, seeks, or changes rate on a different Netflix title; the extension records a skip instead of advancing command sequence when the active tab refuses the command.
- [x] Rollback trigger: A future backwards-compatible command negotiation proves legacy clients can be upgraded without ever applying untargeted commands.
