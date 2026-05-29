# CueRoom Agent Rules

CueRoom is a security-first, open-source co-watch companion. The product is not affiliated with Netflix. It must never capture, proxy, download, record, decrypt, scrape, or redistribute Netflix content or credentials.

## Mandatory Workflow

- [ ] Read `AGENTS.md`, `PLAN.md`, `DECISIONS.md`, `LEARNINGS.md`, and `THREAT_MODEL.md` before changing code.
- [ ] Check current official docs before changing auth, extension, LiveKit, Docker, shadcn/Tailwind, or security-sensitive code.
- [ ] Record material new facts in `LEARNINGS.md` with date, source, stale-by date, and implementation impact.
- [ ] Record architectural choices in `DECISIONS.md` before or with the code change.
- [ ] Keep changes minimal, permanent, and aligned with existing patterns.
- [ ] Prefer small focused commits using Conventional Commits.
- [ ] Never revert other agents' or users' work unless explicitly asked.

## Security Boundaries

- [ ] Never request Chrome permissions for `cookies`, `webRequest`, `debugger`, `<all_urls>`, or broad host access.
- [ ] Never read Netflix cookies, local storage, credentials, DRM keys, subtitles, frames, screenshots, or audio/video streams.
- [ ] Never add remote hosted extension code, CDN scripts, `eval`, dynamic code execution, or page-script injection without a security decision.
- [ ] Validate every REST, WebSocket, and extension message at trust boundaries.
- [ ] Recheck room membership and role server-side for every room action.
- [ ] Treat invite links, room ids, extension messages, WebSocket payloads, and display names as attacker-controlled.
- [ ] Do not persist chat, call media, or detailed watch activity unless a decision explicitly changes the privacy posture.

## Repo Map

- [ ] `apps/web`: Next.js product UI and LiveKit client integration.
- [ ] `apps/api`: Fastify API, room state, auth stubs, sync authorization, LiveKit tokens.
- [ ] `apps/extension`: Chrome/Edge MV3 extension for pairing and Netflix playback observation.
- [ ] `packages/shared`: shared TypeScript contracts and runtime validation.
- [ ] `packages/ui`: CueRoom UI primitives built in the shadcn/Radix style.
- [ ] `packages/security`: reusable security policy checks.
- [ ] `infra/docker`: self-hosting configuration.
- [ ] `scripts`: CI and maintenance checks.
- [ ] `skills`: repo-local agent workflows.

## Subagent Rules

- [ ] Use subagents for bounded workstreams only: security review, extension review, LiveKit/realtime, UI/UX, Docker, cleanup.
- [ ] Give each coding subagent a disjoint file/module ownership area.
- [ ] Subagents must not revert edits made by others.
- [ ] Primary agent owns final integration, test results, security posture, and docs consistency.

## Verification

- [ ] Run the narrowest useful check during development.
- [ ] Before merge, run `pnpm verify`.
- [ ] If a check cannot run, document the reason and risk in the final report.
- [ ] Extension changes require `pnpm security:extension`.
- [ ] Cleanup changes require `pnpm cleanup:check`.
