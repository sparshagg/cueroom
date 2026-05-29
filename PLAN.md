# CueRoom Plan

## M0: Bootstrap

- [x] Create source-of-truth docs.
- [x] Create monorepo workspace structure.
- [x] Add Apache-2.0 license and open-source governance docs.
- [x] Add CI, security, cleanup, and docs freshness checks.
- [x] Create personal GitHub repository and push first commit.
- [x] Configure branch protection and secret scanning in GitHub settings after remote creation.

## M1: Web Shell

- [x] Create Next.js app shell.
- [x] Add shadcn-style UI primitives and Tailwind v4 theme.
- [x] Build welcome, join, lobby, room, chat, and control surfaces.
- [x] Add brand assets and non-affiliation language.
- [x] Add Playwright visual regression coverage.

## M2: API And Rooms

- [x] Create API service with health, rooms, join, lock, kick, rotate invite, and LiveKit token endpoints.
- [x] Add shared contracts and runtime validation.
- [x] Add in-memory store for local development.
- [x] Add PostgreSQL persistence.
- [x] Add Redis-backed presence, invites, rate limits, and sync counters.
- [x] Add passkey and magic-link auth.
- [x] Add production email delivery and account management UI.

## M3: LiveKit Calls

- [x] Add LiveKit token minting surface.
- [x] Add video-call UI controls and device-state UX.
- [x] Connect web client to LiveKit rooms.
- [x] Add mute/camera/device switching integration tests.

## M4: Extension And Sync

- [x] Create MV3 manifest.
- [x] Add content script playback observer for Netflix watch pages.
- [x] Add service-worker pairing and validation skeleton.
- [x] Add extension popup.
- [x] Add extension permission audit.
- [x] Connect extension to live room WebSocket.
- [x] Implement host-authoritative drift correction.
- [x] Add wrong-title warning in room UI.

## M5: Hardening

- [x] Add threat model.
- [x] Add cleanup check and docs freshness check.
- [x] Block stale scaffold language in source-of-truth docs.
- [x] Add CodeQL and dependency workflows.
- [x] Add PostgreSQL/Redis integration tests.
- [x] Serialize Postgres migrations for parallel API workers.
- [x] Add a Postgres migration journal to avoid replaying DDL during parallel tests/startup.
- [x] Add DAST and extension store review checklist evidence.
- [x] Close DAST security-header findings.
- [x] Replace production `unsafe-inline` CSP with per-request nonces.
- [x] Make authenticated DAST medium/high findings blocking in CI.
- [x] Fix DAST PII false positives caused by long decimal runs in random CSP nonces.
- [x] Make extension ZIP packaging deterministic for stable local SHA review.
- [x] Make the local release readiness gate enforce release workflow checksum, attestation, and prerelease invariants.
- [x] Split release workflow package-building and prerelease publishing into read-only and write-scoped jobs.
- [x] Add a Chrome Web Store package evidence checker for ZIP checksum, copied docs, store images, and privacy boundary text.
- [x] Run independent security review.
- [x] Resolve Dependabot PostCSS CVE-2026-41305 alert with a workspace override.

## M6: Public Beta

- [x] Create public privacy policy draft and Chrome Web Store listing/privacy form checklist.
- [x] Create Chrome Web Store privacy answers draft and package evidence gate.
- [x] Package Chrome Web Store artifact with a repeatable release script.
- [x] Generate Chrome Web Store screenshot and promo assets.
- [x] Add deterministic release notes generation from Conventional Commits.
- [ ] Complete human legal/privacy review.
- [x] Publish public repository.
- [ ] Tag first signed release.
- [ ] Open beta with incident response and disclosure process ready.
