# CueRoom Threat Model

## Overview

CueRoom is a web app, API, LiveKit deployment, and Chrome/Edge MV3 extension for private co-watching. The extension observes local Netflix playback state and applies user-authorized playback commands. CueRoom does not stream, capture, store, decrypt, or redistribute Netflix content.

## Trust Boundaries And Assumptions

- [ ] Browser UI to API: all requests are attacker-controlled until authenticated and authorized.
- [ ] WebSocket channel: all messages require schema validation, membership checks, role checks, replay protection, and rate limits.
- [ ] Extension boundary: website-to-extension and content-script-to-service-worker messages are untrusted.
- [ ] Netflix page boundary: the page can change DOM behavior; extension must only observe media state and never collect sensitive Netflix data.
- [ ] LiveKit boundary: tokens must be minted server-side and scoped to one room/member.
- [ ] Storage boundary: PostgreSQL stores minimal account metadata; Redis stores ephemeral room state.
- [ ] Assumption: every viewer has their own lawful Netflix access.
- [ ] Assumption: no official Netflix API or partnership exists for v1.

## Assets

- [ ] Camera and microphone streams.
- [ ] Room membership and invite links.
- [ ] Account sessions, magic-link tokens, and passkey credentials.
- [ ] Host/co-host authority.
- [ ] LiveKit API keys and participant tokens.
- [ ] LiveKit room grants and media device permissions.
- [ ] Extension permissions and release pipeline.
- [ ] Minimal user account metadata.
- [ ] Watch metadata such as title fingerprint and playback position.

## Attacker Stories

- [ ] A leaked invite link lets an unwanted guest join.
- [ ] A guest tries to promote themselves or issue host sync commands.
- [ ] A malicious webpage tries to connect to the extension.
- [ ] A compromised Netflix page script tries to influence content-script messages.
- [ ] A dependency or build script tries to broaden extension permissions.
- [ ] An XSS payload tries to steal room tokens or issue commands.
- [ ] A replayed WebSocket message tries to rewind or pause a room.
- [ ] A leaked magic-link or account session token tries to create rooms as another host.
- [ ] A malicious site tries to complete passkey authentication for the wrong origin or RP ID.
- [ ] A guest tries to use LiveKit data channels or broad media grants to bypass CueRoom's server-authorized sync/chat path.
- [ ] A trusted CueRoom web origin tries to send a direct extension playback command that bypasses server role checks.
- [ ] A guest tries to establish playback authority by sending fake `sync.state` messages.
- [ ] A follower is on the wrong Netflix title and receives drift correction for the host title.

## Required Controls

- [ ] Short-lived invite tokens and room lock/rotate/kick controls.
- [ ] Server-side RBAC on every command.
- [ ] Extension applies only server-broadcast sync commands, never raw website-originated commands.
- [ ] API sends automatic drift corrections only from host playback authority; guest playback state cannot establish authority.
- [ ] Extension applies targeted drift corrections only when the active watch ID matches the correction watch ID.
- [ ] Wrong-title state produces a warning and manual navigation link, never automatic navigation.
- [ ] Runtime schema validation at every trust boundary.
- [ ] Strict CSP and no extension remote code.
- [ ] Minimal Chrome permissions and manifest audits.
- [ ] LiveKit tokens minted only by API.
- [ ] LiveKit grants are scoped to one room and participant, disable data publishing, and only allow camera/microphone publish sources.
- [ ] Account tokens and room tokens have separate prefixes and verification paths.
- [ ] Magic-link tokens are single-use, short-lived, and hashed at rest.
- [ ] Passkey verification checks stored challenge, exact origin, exact RP ID, credential ownership, and counter updates.
- [ ] No call recording or chat persistence by default.
- [ ] Logs exclude secrets, credentials, content, and detailed message payloads.

## Severity Calibration

- [ ] Critical: leaking LiveKit API secret, extension update that captures Netflix credentials, XSS that steals host sessions.
- [ ] High: guest role escalation to host, broad extension permissions, replayable sync commands, invite tokens that never expire.
- [ ] Medium: room metadata retained too long, denial of service on room sync, missing kick/lock enforcement.
- [ ] Low: cosmetic UI defects, non-sensitive telemetry labeling issues, stale docs without behavior impact.
