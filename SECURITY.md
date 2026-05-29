# Security Policy

## Supported Versions

- [ ] `main` receives security fixes.
- [ ] Tagged beta releases receive fixes while listed in the latest release notes.

## Reporting A Vulnerability

- [ ] Do not open a public issue for an exploitable vulnerability.
- [ ] Prefer GitHub private vulnerability reporting at `https://github.com/sparshagg/cueroom/security/advisories/new` after it is enabled for the public repository.
- [ ] Until a dedicated security mailbox is live, use the maintainer contact listed in the GitHub repository profile for sensitive reports that cannot use private vulnerability reporting.
- [ ] Include affected version, reproduction steps, impact, and suggested fix if available.
- [ ] Expect acknowledgement within 72 hours after the project is public.
- [ ] Expect an initial severity assessment within 7 days for complete reports.
- [ ] Do not include Netflix credentials, cookies, DRM keys, subtitles, screenshots, video, audio, invite tokens, or account tokens in public issues.

## Incident Handling

- [ ] Use `docs/security/incident-response.md` for triage, containment, remediation, and disclosure.
- [ ] Publish a GitHub Security Advisory for confirmed vulnerabilities that affect released users.
- [ ] Credit reporters when coordinated disclosure allows it.
- [ ] Move reports containing exploit details or secrets out of public issues.

## Abuse Reports

- [ ] Use the abuse issue template for non-sensitive abuse reports only.
- [ ] Do not include private room links, invite tokens, account tokens, screenshots, Netflix content, or exploit details.
- [ ] CueRoom maintainers may rotate room/invite/account tokens or disable affected rooms without inspecting call media.

## Scope

- [ ] Web/API auth and authorization.
- [ ] Room invite and role enforcement.
- [ ] LiveKit token minting.
- [ ] Extension permissions and message validation.
- [ ] Data retention and logging.

## Out Of Scope

- [ ] Attempts to bypass Netflix DRM or content protections.
- [ ] Attacks requiring control of a user's Netflix account.
- [ ] Social engineering without a CueRoom implementation flaw.
