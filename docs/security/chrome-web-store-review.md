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
- [ ] Store privacy form: disclose playback metadata and room-pairing token use before submission.
- [ ] Privacy policy: publish final hosted policy URL before submission.

## Review Package

- [x] Attach CI extension artifact zip from `pnpm --filter @cueroom/extension build`.
- [x] Attach manifest permission audit output.
- [ ] Attach latest DAST artifact summary.
- [ ] Include tester instructions: create room, load unpacked extension, paste extension ID, open a Netflix watch page, pair extension, verify wrong-title warning.
- [ ] Include non-affiliation statement: CueRoom is not affiliated with Netflix.
- [ ] Include rollback package for the last approved version after first approval.
