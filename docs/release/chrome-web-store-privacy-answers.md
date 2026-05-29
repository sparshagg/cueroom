# Chrome Web Store Privacy Answers Draft

This checklist is the source of truth for Chrome Web Store Privacy practices answers before submission. Do not mark dashboard-submitted release gates complete until a human verifies these answers in the Developer Dashboard.

## Data Collection

- [x] Website content: Yes. CueRoom reads only Netflix watch-page playback metadata needed for sync: watch URL fingerprint, title hint, paused state, current time, duration, playback rate, buffering state, timestamp, and sequence number.
- [x] Personally identifiable information: Yes, only when a host chooses account auth. CueRoom may handle an email address or passkey credential metadata for authentication.
- [x] Authentication information: Yes, only CueRoom room/account session tokens and magic-link/passkey auth material; CueRoom does not collect Netflix credentials, Netflix cookies, or Netflix account data.
- [x] User activity: Yes, limited to room presence, sync state, call state, transient chat, and abuse report metadata needed to provide private co-watch rooms.
- [x] User communications: Yes, room chat messages while a room is active; chat is not persisted by default.
- [x] Location: No.
- [x] Web history: No. CueRoom does not collect browsing history and observes only the active Netflix watch page after user pairing.
- [x] Financial and payment information: No.
- [x] Health information: No.
- [x] Personal communications outside CueRoom room chat: No.

## Data Use

- [x] Use data only to provide private co-watch rooms with video calls, chat, and local playback sync.
- [x] Use playback metadata to authorize host commands, correct drift, warn about wrong titles, and show extension sync health.
- [x] Use auth/session metadata to create rooms, enforce roles, mint scoped LiveKit tokens, and protect against abuse.
- [x] Use abuse report metadata only for safety, security, and moderation triage.
- [x] Do not sell data.
- [x] Do not use or transfer data for personalized advertising, creditworthiness, lending, or unrelated analytics.

## Data Transfer

- [x] Transfer data only to CueRoom API, LiveKit room infrastructure, deployment service providers, or security/abuse processes needed to provide the user-facing service.
- [x] Transmit extension and room data over HTTPS/WSS in production.
- [x] Do not transfer Netflix credentials, cookies, DRM keys, subtitles, screenshots, frames, video, audio, or Netflix account data.

## Limited Use Certification

- [x] Allowed use: CueRoom uses Chrome extension data only to provide or improve the single user-facing purpose of private co-watch rooms with playback sync.
- [x] Allowed transfer: CueRoom transfers extension data only when necessary to provide room sync/calling, protect security, comply with law, or operate the open-source service.
- [x] Prohibited advertising: CueRoom does not use or transfer extension data for personalized advertising.
- [x] Prohibited human interaction: CueRoom does not allow humans to read room data except with user consent for support, for security investigation, to comply with law, or in aggregated/anonymized operational form.

## Privacy Policy Match

- [x] Source policy: `PRIVACY.md`.
- [x] Limited Use disclosure appears in `PRIVACY.md`.
- [x] Data handled matches the `Data CueRoom Handles` section in `PRIVACY.md`.
- [x] Data not handled matches the `Data CueRoom Does Not Handle` section in `PRIVACY.md`.
