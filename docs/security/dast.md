# DAST Evidence

## OWASP ZAP Baseline

- [x] Workflow: `.github/workflows/dast.yml`.
- [x] Trigger: pull requests, pushes to `main`, weekly schedule, and manual dispatch.
- [x] Target: built CueRoom web app at `http://127.0.0.1:3000`.
- [x] API mode: local in-memory API at `http://127.0.0.1:4000`.
- [x] Scan mode: passive baseline spider without alpha active rules for first triage.
- [x] Evidence: ZAP action artifacts plus `cueroom-dast-server-logs`.
- [x] Current gate: non-blocking ZAP findings with workflow artifact review.
- [ ] Beta gate: convert ZAP medium/high findings to blocking after the first baseline triage file is approved.
- [x] Scope expansion base: room participant report API and UI exist for authenticated room sessions.
- [ ] Scope expansion: add authenticated ZAP crawl contexts for room create, join, and report-user flows before public beta.
