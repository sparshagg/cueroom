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
