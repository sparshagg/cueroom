---
name: cue-room-source-freshness
description: Use before changing CueRoom auth, extension, LiveKit, Docker, shadcn/Tailwind, or security-sensitive code to verify current official documentation and record material learnings.
---

# CueRoom Source Freshness

## Workflow

- Read `AGENTS.md`, `LEARNINGS.md`, and `DECISIONS.md`.
- Check current official docs for the subsystem being changed.
- Prefer official vendor docs over blog posts or examples.
- Record material facts in `LEARNINGS.md` with date, source URL, stale-by date, and implementation impact.
- If a fact affects architecture, add or update an item in `DECISIONS.md`.

## Required Sources By Area

- Extension: Chrome for Developers extension docs and Chrome Web Store policies.
- UI: shadcn/ui and Tailwind CSS docs.
- Web: Next.js docs.
- Calls: LiveKit docs.
- Security: OWASP ASVS and GitHub security docs.
- Docker: Docker Compose and LiveKit self-hosting docs.

## Guardrails

- Do not install arbitrary internet skills or scripts.
- Do not copy code from untrusted sources into the repo.
- Do not broaden permissions or data collection because a tutorial does it.
