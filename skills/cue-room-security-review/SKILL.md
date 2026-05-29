---
name: cue-room-security-review
description: Use to review CueRoom changes for auth, authorization, extension permissions, WebSocket trust boundaries, LiveKit token minting, and privacy regressions.
---

# CueRoom Security Review

## Review Checklist

- Verify no Netflix credentials, cookies, DRM keys, frames, screenshots, audio, subtitles, or streams are accessed.
- Verify every REST and WebSocket action checks membership and role server-side.
- Verify every extension message validates origin, room token shape, sender context, and expected tab URL.
- Verify LiveKit tokens are minted only by the API and scoped to one participant and room.
- Verify logs do not contain secrets, tokens, content, or detailed chat payloads.
- Verify extension permissions remain minimal and forbidden permissions are absent.
- Verify new dependencies are necessary and not abandoned.

## Output

- Findings first, ordered by severity.
- Include exact file and line references.
- If no findings, state residual risk and missing tests.
