# DAST Evidence

## OWASP ZAP Baseline

- [x] Workflow: `.github/workflows/dast.yml`.
- [x] Trigger: pull requests, pushes to `main`, weekly schedule, and manual dispatch.
- [x] Target: built CueRoom web app at `http://127.0.0.1:3000`.
- [x] API mode: local in-memory API at `http://127.0.0.1:4000`.
- [x] Scan mode: passive baseline spider without alpha active rules for first triage.
- [x] Evidence: ZAP action artifacts, `cueroom-dast-authenticated-flow`, and `cueroom-dast-server-logs`.
- [x] Current gate: authenticated ZAP evidence must include the required web/API coverage, confirm raw proxy traffic is not uploaded, and contain no medium/high web or API findings.
- [x] Beta gate: convert ZAP medium/high findings to blocking after the first baseline triage file is approved.
- [x] Scope expansion base: room participant report API and UI exist for authenticated room sessions.
- [x] Scope expansion: browser-driven room create, join, and report-user flow is proxied through a local ZAP daemon before the baseline scan.
- [x] Authenticated-flow script: `pnpm dast:authenticated-flows`.
- [x] Sanitized ZAP export: `pnpm dast:export-zap-evidence`.
- [x] Required observed API paths: `POST /v1/rooms`, `POST /v1/rooms/join`, and `POST /v1/rooms/:roomId/report`.
- [x] Artifact safety: uploaded authenticated-flow evidence redacts room session tokens, account session tokens, magic-link tokens, invite codes, room IDs, participant IDs, report IDs, and report details; raw proxy traffic is not uploaded.
- [x] Media boundary: the authenticated DAST browser mocks LiveKit token fetches and blocks browser WebSocket creation so ZAP does not observe LiveKit JWTs, call media, or non-CueRoom local services.
- [x] Limitation: this covers authenticated room-session flows with `AUTH_REQUIRED=false`; production account-authenticated room creation remains covered by API tests and manual release review, not by the DAST browser flow.
- [x] Latest reviewed artifact: GitHub run `26655805890` for commit `f34f0b0` generated `2026-05-29T18:49:06.013Z`; coverage was complete, API alerts were `0`, web alerts were `1` informational `Modern Web Application`, and the evidence showed Next.js script nonces.
