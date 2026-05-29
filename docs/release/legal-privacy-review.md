# Legal And Privacy Review

This file records human review evidence before the first public beta. Do not check the sign-off items until the reviewer, date, and scope are real.

## Review Status

- [ ] Legal reviewer name, role, and date recorded.
- [ ] Privacy reviewer name, role, and date recorded.
- [ ] Public beta domain and hosted privacy policy URL recorded.
- [ ] Chrome Web Store developer account owner recorded.
- [ ] Final extension ID recorded after first approved upload.

## Legal Checklist

- [ ] CueRoom name and logo do not imply Netflix affiliation.
- [ ] README, Chrome Web Store listing, web UI, and extension popup include non-affiliation language.
- [ ] Product copy does not claim to stream, proxy, redistribute, record, download, or bypass Netflix content.
- [ ] Product behavior requires each viewer to use their own lawful Netflix session.
- [ ] Netflix Terms boundary has been reviewed by a qualified human reviewer.
- [ ] Trademark and brand review accepts avoiding Netflix-red branding and Netflix marks.

## Privacy Checklist

- [ ] `PRIVACY.md` matches the current implementation.
- [ ] Chrome Web Store privacy answers match `PRIVACY.md`.
- [ ] Extension data handling matches `docs/security/chrome-web-store-review.md`.
- [ ] Room chat remains transient by default.
- [ ] Abuse reports persist only bounded report metadata and optional reporter-provided details.
- [ ] Account/session tokens are hashed server-side where persisted.
- [ ] Magic-link tokens are sent in URL fragments and verified through request bodies.
- [ ] LiveKit JWTs are short-lived and held in browser memory only.
- [ ] CueRoom does not collect Netflix credentials, cookies, DRM keys, subtitles, screenshots, video, audio, or account data.

## Release Evidence

- [ ] `pnpm release:check -- --tag v0.1.0` passes locally before tagging.
- [ ] `git tag -s v0.1.0 -m "CueRoom v0.1.0"` or approved annotated fallback is recorded.
- [ ] `git verify-tag v0.1.0` passes for signed tags.
- [ ] Release workflow uploads the extension ZIP, `SHA256SUMS`, and `release-manifest.json`.
- [ ] `gh attestation verify artifacts/chrome-web-store/cueroom-extension-0.1.0.zip --repo sparshagg/cueroom --signer-workflow sparshagg/cueroom/.github/workflows/release.yml --source-ref refs/tags/v0.1.0` passes for the release artifact.
