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
