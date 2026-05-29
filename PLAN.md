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
- [ ] Add Playwright visual regression coverage.

## M2: API And Rooms

- [x] Create API service with health, rooms, join, lock, kick, rotate invite, and LiveKit token endpoints.
- [x] Add shared contracts and runtime validation.
- [x] Add in-memory store for local development.
- [x] Add PostgreSQL persistence.
- [x] Add Redis-backed presence, invites, rate limits, and sync counters.
- [ ] Add passkey and magic-link auth.

## M3: LiveKit Calls

- [x] Add LiveKit token minting surface.
- [x] Add video-call UI controls and device-state UX.
- [ ] Connect web client to LiveKit rooms.
- [ ] Add mute/camera/device switching integration tests.

## M4: Extension And Sync

- [x] Create MV3 manifest.
- [x] Add content script playback observer for Netflix watch pages.
- [x] Add service-worker pairing and validation skeleton.
- [x] Add extension popup.
- [x] Add extension permission audit.
- [ ] Connect extension to live room WebSocket.
- [ ] Implement host-authoritative drift correction.
- [ ] Add wrong-title warning in room UI.

## M5: Hardening

- [x] Add threat model.
- [x] Add cleanup check and docs freshness check.
- [x] Add CodeQL and dependency workflows.
- [ ] Add PostgreSQL/Redis integration tests.
- [ ] Add DAST and extension store review checklist evidence.
- [ ] Run independent security review.

## M6: Public Beta

- [ ] Complete legal/privacy review.
- [ ] Package Chrome Web Store artifact.
- [x] Publish public repository.
- [ ] Tag first signed release.
- [ ] Open beta with incident response and disclosure process ready.
