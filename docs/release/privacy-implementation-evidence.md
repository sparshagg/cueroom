# Privacy Implementation Evidence

This is repo-owned implementation evidence for privacy review. It does not replace human legal or privacy sign-off in `docs/release/legal-privacy-review.md`.

## Room Chat Transience

- [x] Claim: Room chat remains transient by default.
- [x] Implementation sources:
  - `apps/web/src/components/RoomExperience.tsx`
  - `packages/shared/src/messages.ts`
  - `apps/api/src/routes.ts`
- [x] Tests/checks:
  - `scripts/check-privacy-evidence.mjs`
- [x] Verification commands:
  - `pnpm privacy:evidence`
  - `pnpm --filter @cueroom/web test`
- [x] Evidence note: Room chat is currently component-local UI state only; the shared realtime schema and API routes do not define a persistent chat message endpoint.

## Abuse Report Boundaries

- [x] Claim: Abuse reports persist only bounded report metadata and optional reporter-provided details.
- [x] Implementation sources:
  - `packages/shared/src/rooms.ts`
  - `apps/api/src/routes.ts`
  - `apps/api/src/postgres-room-store.ts`
  - `apps/api/migrations/004_room_reports.sql`
- [x] Tests/checks:
  - `apps/api/test/routes.test.ts`
  - `apps/api/test/postgres-room-store.test.ts`
  - `scripts/check-privacy-evidence.mjs`
- [x] Verification commands:
  - `pnpm privacy:evidence`
  - `pnpm --filter @cueroom/api test`
- [x] Evidence note: Details are optional, capped at 500 characters in the API schema and database constraint, omitted from public report responses, and omitted from the route warning log.

## Hashed Token Persistence

- [x] Claim: Account/session tokens are hashed server-side where persisted.
- [x] Implementation sources:
  - `apps/api/src/auth-store.ts`
  - `apps/api/src/postgres-auth-store.ts`
  - `apps/api/src/postgres-room-store.ts`
  - `apps/api/migrations/001_rooms_sessions.sql`
  - `apps/api/migrations/002_auth.sql`
- [x] Tests/checks:
  - `apps/api/test/auth-store.test.ts`
  - `apps/api/test/postgres-room-store.test.ts`
  - `scripts/check-privacy-evidence.mjs`
- [x] Verification commands:
  - `pnpm privacy:evidence`
  - `pnpm --filter @cueroom/api test`
- [x] Evidence note: Room, account-session, and magic-link tokens are generated as opaque bearer tokens and persisted only through token hash columns in PostgreSQL-backed stores.

## Magic Link Token Handling

- [x] Claim: Magic-link tokens are sent in URL fragments and verified through request bodies.
- [x] Implementation sources:
  - `apps/api/src/auth-store.ts`
  - `apps/api/src/routes.ts`
  - `apps/web/src/components/AuthMagicLinkVerifier.tsx`
  - `apps/web/src/lib/api.ts`
- [x] Tests/checks:
  - `apps/api/test/auth-store.test.ts`
  - `apps/api/test/routes.test.ts`
  - `apps/web/src/lib/api.test.ts`
  - `scripts/check-privacy-evidence.mjs`
- [x] Verification commands:
  - `pnpm privacy:evidence`
  - `pnpm --filter @cueroom/api test`
  - `pnpm --filter @cueroom/web test`
- [x] Evidence note: Email delivery receives a fragment-link URL, the web verifier strips the hash from the address bar, and API verification posts the token in a JSON body instead of a query string.

## LiveKit Token Handling

- [x] Claim: LiveKit JWTs are short-lived and held in browser memory only.
- [x] Implementation sources:
  - `apps/api/src/livekit.ts`
  - `apps/api/src/routes.ts`
  - `apps/web/src/components/useLiveKitCall.ts`
- [x] Tests/checks:
  - `apps/api/test/livekit.test.ts`
  - `apps/api/test/routes.test.ts`
  - `apps/web/src/components/useLiveKitCall.test.tsx`
  - `scripts/check-privacy-evidence.mjs`
- [x] Verification commands:
  - `pnpm privacy:evidence`
  - `pnpm --filter @cueroom/api test`
  - `pnpm --filter @cueroom/web test`
- [x] Evidence note: The API mints 10-minute room-scoped LiveKit tokens, the web client passes the token directly to `room.connect`, and regression coverage asserts LiveKit tokens are not written to browser storage.

## Netflix Sensitive Data Boundary

- [x] Claim: CueRoom does not collect Netflix credentials, cookies, DRM keys, subtitles, screenshots, video, audio, or account data.
- [x] Implementation sources:
  - `apps/extension/src/manifest.json`
  - `apps/extension/src/content-script.ts`
  - `apps/extension/src/media-control.ts`
  - `packages/shared/src/messages.ts`
  - `packages/security/src/index.ts`
  - `scripts/audit-extension.mjs`
- [x] Tests/checks:
  - `apps/extension/test/manifest.test.ts`
  - `apps/extension/test/media-control.test.ts`
  - `packages/shared/src/messages.test.ts`
  - `packages/security/src/index.test.ts`
  - `scripts/check-privacy-evidence.mjs`
- [x] Verification commands:
  - `pnpm privacy:evidence`
  - `pnpm security:extension`
  - `pnpm --filter @cueroom/extension test`
  - `pnpm --filter @cueroom/shared test`
  - `pnpm --filter @cueroom/security test`
- [x] Evidence note: The extension manifest is scoped to Netflix watch pages and approved CueRoom origins, the content script sends only sanitized playback metadata, and extension audits forbid sensitive permissions and remote-code patterns.
