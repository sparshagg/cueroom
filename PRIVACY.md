# CueRoom Privacy Policy

Last updated: May 29, 2026

CueRoom is an open-source, non-affiliated co-watch companion for private watch rooms with video calls, chat, and Netflix playback sync. CueRoom does not stream, record, inspect, or redistribute Netflix video or audio.

## Data CueRoom Handles

- [x] Account data: optional email address or passkey credential metadata for hosts who sign in.
- [x] Room data: room IDs, invite codes, participant display names, participant roles, room lock state, and short-lived room session tokens.
- [x] Playback sync metadata: Netflix watch URL fingerprint, title hint, paused state, current time, duration, playback rate, buffering state, timestamp, and sequence number.
- [x] Call metadata: LiveKit participant identity, room identity, media mute/camera state, and connection state.
- [x] Chat data: in-room chat messages while the room is active. Chat is not persisted by default.
- [x] Abuse report data: reporter participant ID, reported participant ID, reason, optional bounded details, room ID, and timestamp when a participant submits a room report.
- [x] Security data: minimal audit events and rate-limit state needed to protect rooms and investigate abuse.

## Data CueRoom Does Not Handle

- [x] No Netflix credentials.
- [x] No Netflix cookies.
- [x] No Netflix account data.
- [x] No Netflix DRM keys.
- [x] No Netflix subtitles.
- [x] No Netflix screenshots, frames, video, or audio.
- [x] No call recording.
- [x] No advertising identifiers.

## How CueRoom Uses Data

- [x] Create and join private watch rooms.
- [x] Authorize room roles, invite tokens, and room lock/kick actions.
- [x] Mint scoped LiveKit tokens for room audio/video calls.
- [x] Sync local playback state between participants who each use their own lawful Netflix session.
- [x] Show wrong-title warnings and manual navigation links when participants are not on the same Netflix watch page.
- [x] Detect abuse, enforce rate limits, debug service health, and respond to security reports.
- [x] Receive and triage room participant reports without inspecting Netflix content or call media.

CueRoom does not sell personal data, use personal data for targeted advertising, or transfer extension user data to advertising platforms or data brokers.

## Chrome Web Store Limited Use

- [x] CueRoom uses Chrome extension data only to provide or improve the single user-facing purpose of private co-watch rooms with playback sync.
- [x] CueRoom transfers extension data only when necessary to provide the room sync feature, protect security, comply with law, or operate the open-source service.
- [x] CueRoom does not use or transfer extension data for personalized advertising.
- [x] CueRoom does not allow humans to read room data except with user consent for support, for security investigation, to comply with law, or in aggregated/anonymized operational form.

CueRoom's use of information received from Chrome extension APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Storage And Retention

- [x] Room pairing data is stored locally in extension storage and can be removed by disconnecting the extension.
- [x] Room session data is stored in web `sessionStorage` for the current browser session.
- [x] Redis data such as invites, room state, presence, sync counters, and rate limits is ephemeral.
- [x] PostgreSQL stores only minimal account and room metadata needed for private rooms.
- [x] PostgreSQL stores room participant reports so maintainers can investigate abuse; report responses and logs omit free-text report details by default.
- [x] Chat messages are not persisted by default.

## User Choices

- [x] Do not install or pair the extension if you do not want CueRoom to observe local playback metadata.
- [x] Disconnect the extension from the popup to remove the local room pairing.
- [x] Leave a room to stop room presence, chat, sync, and call participation.
- [x] Disable microphone or camera at any time from room controls.
- [x] Submit room participant reports without including Netflix content, credentials, invite links, account tokens, or private room links.

## Contact

- [x] Use GitHub issues for non-sensitive privacy questions.
- [x] Use the security reporting path in `SECURITY.md` for vulnerabilities or sensitive privacy reports.
