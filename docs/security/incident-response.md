# Incident Response

CueRoom's incident response process is designed for a privacy-preserving co-watch product. The project must not inspect Netflix content, call media, or chat content unless a future decision explicitly changes that boundary.

## Intake

- [ ] Prefer GitHub private vulnerability reporting for security vulnerabilities after it is enabled.
- [ ] Use `SECURITY.md` for vulnerability report expectations and response targets.
- [ ] Use the abuse report issue template only for non-sensitive abuse reports.
- [ ] Use the in-room report action for room participant abuse that can be tied to a current room session.
- [ ] Move reports containing secrets, invite tokens, account tokens, or exploit details into a private channel.
- [ ] Acknowledge security reports within 72 hours after public beta opens.

## Triage

- [ ] Classify impact using `THREAT_MODEL.md` severity examples.
- [ ] Identify whether the issue affects web/API auth, extension permissions, room authorization, LiveKit token minting, data retention, or release artifacts.
- [ ] Preserve only minimal metadata needed for investigation.
- [ ] Do not request Netflix credentials, screenshots, video, audio, cookies, subtitles, or DRM data.
- [ ] Confirm whether the issue affects the latest release tag, `main`, or both.

## Containment

- [ ] Revoke leaked API, SMTP, LiveKit, GitHub, or Chrome Web Store secrets immediately.
- [ ] Disable affected deployment routes or extension rollout if user compromise is plausible.
- [ ] Rotate room/account tokens when token disclosure is suspected.
- [ ] Remove or unlist affected Chrome Web Store package if extension behavior violates the privacy boundary.
- [ ] Keep containment notes private until disclosure is safe.

## Remediation

- [ ] Add or update regression tests before landing the fix.
- [ ] Run `pnpm verify`, `pnpm security:extension`, and targeted checks for the affected component.
- [ ] Update `THREAT_MODEL.md`, `DECISIONS.md`, `RUNBOOK.md`, or `LEARNINGS.md` when the incident changes assumptions.
- [ ] Prepare a patched release package with artifact attestation when released users are affected.

## Disclosure

- [ ] Publish a GitHub Security Advisory for confirmed vulnerabilities that affect released users.
- [ ] Credit reporters when they request credit and disclosure is coordinated.
- [ ] Include affected versions, impact, workaround, fixed version, and whether credentials or tokens need rotation.
- [ ] Avoid publishing exploit detail before a fix and reasonable upgrade window exist.

## Public Beta Operational Readiness

- [x] Enable GitHub private vulnerability reporting before the first public beta tag.
- [ ] Confirm at least one maintainer watches repository security notifications.
- [ ] Confirm `SECURITY.md` points to a working sensitive-report path.
- [ ] Confirm non-sensitive abuse reports use `.github/ISSUE_TEMPLATE/abuse_report.md`.
- [ ] Confirm release artifacts include checksums and attestations before user installation.
