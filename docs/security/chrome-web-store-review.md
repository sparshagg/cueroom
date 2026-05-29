# Chrome Web Store Review Evidence

## Manifest Boundary

- [x] Manifest version is MV3.
- [x] Minimum Chrome version is 116 because the service worker keeps a room WebSocket alive with pings.
- [x] Host permissions are limited to `https://www.netflix.com/watch/*`.
- [x] `externally_connectable.matches` is limited to approved CueRoom origins.
- [x] Permissions exclude `cookies`, `webRequest`, `debugger`, `<all_urls>`, broad host access, and sensitive execution permissions.
- [x] Extension CSP uses extension-local scripts only.
- [x] Build audit: `pnpm security:extension`.
- [x] CI evidence artifact: `cueroom-chrome-web-store-review`.

## Data Handling

- [x] Extension observes local playback metadata only: watch ID, title hint, safe watch URL, pause state, timing, playback rate, buffering, timestamp, and sequence.
- [x] Extension does not read Netflix credentials, cookies, local/session storage, DRM keys, subtitles, frames, screenshots, video, or audio.
- [x] Pairing stores only room-scoped CueRoom session data, the allowed app/API origins, and the paired Netflix tab ID.
- [x] Wrong-title handling shows a manual link to the expected Netflix title and never auto-navigates.
- [x] Store privacy form draft: disclose playback metadata, room-pairing token use, optional auth data, transient chat, and no advertising use.
- [x] Privacy policy source: `PRIVACY.md`.
- [x] Privacy answers source: `docs/release/chrome-web-store-privacy-answers.md`.
- [ ] Privacy policy: publish final hosted policy URL before submission.

## Review Package

- [x] Attach CI extension artifact zip from `pnpm --filter @cueroom/extension build`.
- [x] Attach manifest permission audit output.
- [x] Attach `SHA256SUMS` and `release-manifest.json` from `pnpm extension:package`.
- [x] Package evidence gate: `pnpm store:check-package`.
- [x] Attach latest DAST artifact summary.
- [x] Attach deterministic release notes from `pnpm release:notes` to the GitHub prerelease.
- [x] Include tester instructions from `docs/release/chrome-web-store-listing.md`.
- [x] Include privacy answers from `docs/release/chrome-web-store-privacy-answers.md`.
- [x] Include non-affiliation statement: CueRoom is not affiliated with Netflix.
- [x] Latest local package review: deterministic `cueroom-extension-0.1.0.zip` SHA-256 `f7efbbf59784ff3e845d8400f4445e0c7d8c043373a49543950bf8f5e6c0c8d8`; `SHA256SUMS` verified; manifest audit passed; screenshots/promos are `1280x800`, `640x400`, `440x280`, and `1400x560`.
- [ ] Verify GitHub artifact attestation for the release ZIP before Chrome Web Store submission.
- [ ] Include rollback package for the last approved version after first approval.
