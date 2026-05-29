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
