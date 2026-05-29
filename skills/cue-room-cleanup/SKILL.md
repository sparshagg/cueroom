---
name: cue-room-cleanup
description: Use when detecting or removing unused CueRoom code, dependencies, assets, routes, feature flags, stale TODOs, or generated artifacts.
---

# CueRoom Cleanup

## Workflow

- Run `pnpm cleanup:check`.
- Treat generated build output as deletable.
- Treat source deletion as a reviewed PR requiring tests.
- Remove dead code only when behavior is covered or clearly unreachable.
- Update `PLAN.md` or `DECISIONS.md` if cleanup changes project scope.

## Do Not

- Silently delete protected-branch source.
- Remove security checks because they are noisy.
- Delete docs that encode active decisions or threat-model assumptions.
