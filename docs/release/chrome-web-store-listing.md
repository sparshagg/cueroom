# Chrome Web Store Listing Draft

## Store Listing Copy

- [x] Name: CueRoom.
- [x] Short description: Private Netflix co-watch rooms with video calls, chat, and local playback sync.
- [x] Detailed description: CueRoom helps friends watch Netflix together while each participant uses their own Netflix account and local browser session. Create a private room, start a call, pair the extension, and keep playback aligned with host-authorized play, pause, and seek commands. CueRoom does not stream Netflix content, capture video/audio, read credentials, read cookies, bypass DRM, or record calls. CueRoom is not affiliated with, endorsed by, sponsored by, or approved by Netflix.
- [x] Category: Communication or Productivity; final category depends on Chrome Web Store dashboard availability.
- [x] Language: English.
- [x] Website: `https://cueroom.app` once the public beta site is live.
- [x] Privacy policy URL: `https://cueroom.app/privacy` once the public beta site is live.
- [x] Support URL: GitHub issues for non-sensitive support after public launch.

## Privacy Practices Draft

- [x] Disclose website content access limited to `https://www.netflix.com/watch/*`.
- [x] Disclose playback metadata used for sync: watch URL fingerprint, title hint, paused state, current time, duration, playback rate, buffering state, timestamp, and sequence number.
- [x] Disclose room-pairing token storage in extension storage.
- [x] Disclose optional account email or passkey metadata for authenticated hosts.
- [x] Disclose room chat messages as transient room data with no default persistence.
- [x] Certify that data is not sold, not used for personalized advertising, and not transferred except to provide room sync/calling, protect security, comply with law, or operate the service.
- [x] Use `PRIVACY.md` as the source for the hosted privacy policy.
- [x] Use `docs/release/chrome-web-store-privacy-answers.md` as the dashboard-answer source.

## Tester Instructions

- [x] Load the ZIP package from `artifacts/chrome-web-store`.
- [x] Create or join a CueRoom room from the web app.
- [x] Copy the extension ID into the room page when using a local unpacked build.
- [x] Open `https://www.netflix.com/watch/<title-id>` in a signed-in Netflix browser session.
- [x] Pair the extension from the room page.
- [x] Confirm popup shows paired room state.
- [x] Confirm play, pause, and seek commands sync between host and follower tabs.
- [x] Confirm wrong-title state shows a manual navigation warning and never auto-navigates.
- [x] Confirm disconnect removes the local pairing.

## Required Visual Assets

- [x] Extension icon in package: `apps/extension/src/icons/icon128.svg`.
- [x] CI visual evidence artifact: `cueroom-visual-regression`.
- [x] Store screenshot: room UI with video call controls and sync health, generated as `images/room-ui-1280x800.png`.
- [x] Store screenshot: extension popup paired to a room, generated as `images/extension-popup-640x400.png`.
- [x] Small promo tile: 440x280, generated as `images/small-promo-440x280.png`.
- [x] Optional marquee promo tile: 1400x560, generated as `images/marquee-promo-1400x560.png`.
- [ ] Optional YouTube demo video.

## Release Blockers

- [ ] Hosted privacy policy URL is live.
- [x] Hosted privacy policy route exists at `/privacy` and is linked one click from the home page.
- [ ] Public beta domain is live and listed in `externally_connectable.matches`.
- [ ] `docs/release/public-beta-checklist.md` Required Before Tagging section is fully checked.
- [x] GitHub private vulnerability reporting is enabled for the public repository.
- [x] Store screenshots and promo tile are generated from the current UI/package.
- [x] Release package includes `SHA256SUMS` and `release-manifest.json`.
- [ ] Human legal review confirms non-affiliation, Netflix Terms boundary, and privacy disclosures.
- [ ] First public beta tag is cut from protected `main`.
- [ ] Release artifact attestation verifies for the uploaded extension ZIP.
