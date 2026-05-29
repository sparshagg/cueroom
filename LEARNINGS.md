# Learnings

Append-only checklist of verified project learnings.

## 2026-05-29

- [ ] Source: https://nextjs.org/docs/app
  - Stale-by: 2026-08-29
  - Learning: The App Router is the current Next.js routing model and supports React Server Components.
  - Impact: `apps/web` uses App Router under `src/app`.
- [ ] Source: https://ui.shadcn.com/docs/tailwind-v4
  - Stale-by: 2026-08-29
  - Learning: New shadcn projects use Tailwind v4, React 19, OKLCH tokens, `new-york` style, and Sonner instead of the old toast component.
  - Impact: UI primitives use Tailwind v4 tokens and Sonner is included.
- [ ] Source: https://docs.livekit.io/home/get-started/authentication
  - Stale-by: 2026-08-29
  - Learning: LiveKit access tokens must be generated server-side because they are signed with API secrets.
  - Impact: `apps/api` exposes a room-scoped token endpoint instead of minting tokens in the web app.
- [ ] Source: https://docs.livekit.io/transport/self-hosting/
  - Stale-by: 2026-08-29
  - Learning: LiveKit can be self-hosted and needs explicit production networking/TURN planning.
  - Impact: Docker includes a LiveKit service and the runbook calls out TURN/TLS hardening.
- [ ] Source: https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions
  - Stale-by: 2026-08-29
  - Learning: Extensions should request the narrowest permissions needed.
  - Impact: The MV3 manifest avoids broad host access and forbidden permissions.
- [ ] Source: https://developer.chrome.com/docs/apps/manifest/externally_connectable
  - Stale-by: 2026-08-29
  - Learning: `externally_connectable.matches` must use explicit URL patterns and cannot use `<all_urls>`.
  - Impact: The extension allows only local and production CueRoom origins.
- [ ] Source: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq
  - Stale-by: 2026-08-29
  - Learning: Chrome Web Store policies require minimum permissions and clear limited-use disclosure for user data.
  - Impact: `RUNBOOK.md` requires a store-policy review before release.
- [ ] Source: https://help.netflix.com/en/legal/termsofuse
  - Stale-by: 2026-08-29
  - Learning: Netflix content and account access are governed by restrictive terms and content protection rules.
  - Impact: CueRoom never relays content and requires legal review before public extension release.
