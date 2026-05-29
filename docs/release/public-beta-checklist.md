# Public Beta Checklist

This checklist is the source of truth for the first public beta release gate. Items in "Required Before Tagging" must be checked before pushing the first `v0.1.0` release tag.

## Required Before Tagging

- [ ] PR branch is approved and merged into protected `main`.
- [ ] Human legal review confirms non-affiliation language, Netflix Terms boundary, and no content redistribution claim.
- [ ] Human privacy review confirms `PRIVACY.md`, Chrome Web Store privacy answers, and in-app data boundary match current behavior.
- [ ] Hosted privacy policy URL is live and matches `PRIVACY.md`.
- [ ] Public beta web domain is live and matches `apps/extension/src/manifest.json` `externally_connectable.matches`.
- [ ] Maintainer has enabled GitHub private vulnerability reporting for the public repository.
- [ ] Maintainer has watched the repository for security notifications.
- [ ] Current `main` has green `verify`, `docker`, `CodeQL`, `cleanup`, `supply-chain`, and `zap-baseline` checks.
- [x] DAST workflow includes authenticated room-session create, join, and report-user flow evidence.
- [ ] Latest DAST artifacts are reviewed, and every medium/high finding is either fixed or explicitly accepted in a tracked security note.
- [ ] `pnpm extension:package` artifacts have been reviewed, including the ZIP, manifest audit, privacy policy copy, listing draft, and generated images.
- [ ] Release package `SHA256SUMS` verifies locally.
- [ ] `pnpm release:notes -- --tag v0.1.0 --output artifacts/release-notes/v0.1.0.md` has been reviewed for user-facing accuracy.
- [ ] `pnpm release:check -- --tag v0.1.0` passes before tagging.
- [x] In-room report-user flow has API, UI, and regression coverage.
- [ ] No open high or critical security findings remain in CodeQL, Dependabot, DAST review, or manual security review.
- [ ] Release signing process is recorded in `RUNBOOK.md`, including the approved annotated-tag fallback if signing is unavailable.

## Required Before Chrome Web Store Submission

- [ ] `artifacts/chrome-web-store/cueroom-extension-0.1.0.zip` is attached to the GitHub prerelease or CI artifact.
- [ ] Artifact attestation is available for the extension ZIP and can be verified with `gh attestation verify`.
- [ ] Chrome Web Store listing copy matches `docs/release/chrome-web-store-listing.md`.
- [ ] Chrome Web Store privacy answers match `PRIVACY.md`.
- [ ] Review package includes screenshots and promo assets from `artifacts/chrome-web-store/images`.
- [ ] Review package includes non-affiliation statement and no-sensitive-Netflix-data explanation.
- [ ] Rollback plan points to the last approved extension package, once one exists.

## Required After Beta Opens

- [ ] Confirm the GitHub prerelease notes link the Chrome Web Store listing, privacy policy, and security reporting path after those URLs are live.
- [ ] Monitor GitHub private vulnerability reports, Dependabot alerts, CodeQL, DAST artifacts, and abuse reports daily for the first week.
- [ ] Track Chrome Web Store rejection or policy feedback in a public issue unless it contains sensitive details.
- [ ] Record any material release finding in `LEARNINGS.md` and update this checklist before the next beta.
