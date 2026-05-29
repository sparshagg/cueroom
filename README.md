# CueRoom

CueRoom is an open-source, non-affiliated co-watch companion for private watch rooms with video calls, chat, and local Netflix playback sync.

CueRoom does not stream Netflix content. Every participant watches through their own lawful Netflix session. The extension observes only local playback metadata and applies user-authorized playback commands.

## Status

- [x] Monorepo scaffold.
- [x] Web UI v0.
- [x] API room/sync skeleton.
- [x] Postgres-backed room/session persistence.
- [x] Chrome/Edge MV3 extension skeleton.
- [x] Docker and CI skeleton.
- [ ] Redis presence/rate limits/sync counters.
- [ ] Production auth.
- [ ] Public beta.

## Apps

- [ ] `apps/web`: Next.js app for lobby, room, call controls, chat, and extension pairing.
- [ ] `apps/api`: Fastify API for rooms, invites, sync authorization, and LiveKit tokens.
- [ ] `apps/extension`: Chrome/Edge MV3 extension for Netflix playback observation.

## Quick Start

```bash
fnm use 24.14.0 # or nvm use
pnpm install
pnpm dev
```

Then open:

- Web: http://localhost:3000
- API health: http://localhost:4000/health

For the containerized stack with Postgres, Redis, and LiveKit:

```bash
docker compose -f infra/docker/compose.dev.yml up --build
```

## Security Promise

- [ ] No Netflix credentials.
- [ ] No Netflix cookies.
- [ ] No video/audio capture from Netflix.
- [ ] No DRM bypass.
- [ ] No call recording.
- [ ] No chat persistence by default.
- [ ] Minimum extension permissions only.

## Non-Affiliation

CueRoom is not affiliated with, endorsed by, sponsored by, or approved by Netflix.
