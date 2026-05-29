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
- [x] Scope expansion: browser-driven magic-link sign-in, auth-required room create, join, and report-user flow is proxied through a local ZAP daemon before the baseline scan.
- [x] Authenticated-flow script: `pnpm dast:authenticated-flows`.
- [x] Sanitized ZAP export: `pnpm dast:export-zap-evidence`.
- [x] Required observed auth paths: `POST /v1/auth/magic-link/request` and `POST /v1/auth/magic-link/verify` when `DAST_REQUIRE_ACCOUNT_AUTH_ZAP=true`.
- [x] Required observed room paths: `POST /v1/rooms`, `POST /v1/rooms/join`, and `POST /v1/rooms/:roomId/report`.
- [x] Artifact safety: uploaded authenticated-flow evidence redacts room session tokens, account session tokens, magic-link tokens, invite codes, room IDs, participant IDs, report IDs, and report details; raw proxy traffic is not uploaded.
- [x] Media boundary: the authenticated DAST browser mocks LiveKit token fetches and blocks browser WebSocket creation so ZAP does not observe LiveKit JWTs, call media, or non-CueRoom local services.
- [x] Account-auth boundary: CI runs the DAST app with `AUTH_REQUIRED=true`, `AUTH_DEV_MAGIC_LINKS=true`, and localhost WebAuthn origin/RP settings so ZAP observes the same account-session authorization path used by production room creation without exposing real email delivery secrets.
- [x] Latest local account-auth smoke: `2026-05-29T23:06:03.482Z` against fresh local servers confirmed `accountAuthRequired: true`, two participants, a created report, and observed magic-link request/verify plus room create/join/report paths.
- [x] Latest reviewed artifact: GitHub run `26659820255` for commit `d41f3fc` generated `2026-05-29T20:14:27.494Z`; coverage was complete, API alerts were `0`, web alerts were `1` informational `Modern Web Application`, and the evidence passed `pnpm dast:check-zap-evidence` after scanner-safe base64url CSP nonce generation removed the prior false-positive PII alert.
