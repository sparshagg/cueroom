import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const evidencePath = "docs/release/privacy-implementation-evidence.md";
const evidence = readText(evidencePath);
const failures = [];

const requiredEvidence = [
  {
    claim: "Room chat remains transient by default.",
    sources: [
      "apps/web/src/components/RoomExperience.tsx",
      "packages/shared/src/messages.ts",
      "apps/api/src/routes.ts"
    ],
    checks: ["scripts/check-privacy-evidence.mjs"],
    commands: ["pnpm privacy:evidence", "pnpm --filter @cueroom/web test"],
    includes: [
      {
        filePath: "apps/web/src/components/RoomExperience.tsx",
        text: "const [messages, setMessages] = useState(initialMessages);"
      },
      {
        filePath: "apps/web/src/components/RoomExperience.tsx",
        text: "setMessages((current) => ["
      }
    ],
    excludes: [
      { filePath: "packages/shared/src/messages.ts", text: "chat.message" },
      { filePath: "apps/api/src/routes.ts", text: "/chat" }
    ]
  },
  {
    claim:
      "Abuse reports persist only bounded report metadata and optional reporter-provided details.",
    sources: [
      "packages/shared/src/rooms.ts",
      "apps/api/src/routes.ts",
      "apps/api/src/postgres-room-store.ts",
      "apps/api/migrations/004_room_reports.sql"
    ],
    checks: [
      "apps/api/test/routes.test.ts",
      "apps/api/test/postgres-room-store.test.ts",
      "scripts/check-privacy-evidence.mjs"
    ],
    commands: ["pnpm privacy:evidence", "pnpm --filter @cueroom/api test"],
    includes: [
      { filePath: "packages/shared/src/rooms.ts", text: "details: z.string().trim().max(500)" },
      {
        filePath: "apps/api/migrations/004_room_reports.sql",
        text: "char_length(details) <= 500"
      },
      {
        filePath: "apps/api/src/postgres-room-store.ts",
        text: "input.details?.trim() || null"
      },
      {
        filePath: "apps/api/src/postgres-room-store.ts",
        text: "function reportFromRow(row: RoomReportRow): RoomReport"
      },
      {
        filePath: "apps/api/test/routes.test.ts",
        text: "accepts authenticated room participant reports without returning report details"
      },
      {
        filePath: "apps/api/test/postgres-room-store.test.ts",
        text: "persists bounded participant reports without exposing details in the response"
      }
    ],
    excludes: [{ filePath: "apps/api/src/routes.ts", text: "details: result.report" }]
  },
  {
    claim: "Account/session tokens are hashed server-side where persisted.",
    sources: [
      "apps/api/src/auth-store.ts",
      "apps/api/src/postgres-auth-store.ts",
      "apps/api/src/postgres-room-store.ts",
      "apps/api/migrations/001_rooms_sessions.sql",
      "apps/api/migrations/002_auth.sql"
    ],
    checks: [
      "apps/api/test/auth-store.test.ts",
      "apps/api/test/postgres-room-store.test.ts",
      "scripts/check-privacy-evidence.mjs"
    ],
    commands: ["pnpm privacy:evidence", "pnpm --filter @cueroom/api test"],
    includes: [
      {
        filePath: "apps/api/src/auth-store.ts",
        text: "export function hashSecret(secret: string)"
      },
      {
        filePath: "apps/api/src/postgres-auth-store.ts",
        text: "INSERT INTO auth_sessions (token_hash, account_id, expires_at, auth_method)"
      },
      {
        filePath: "apps/api/src/postgres-auth-store.ts",
        text: "INSERT INTO magic_links (token_hash, email_normalized, display_name, expires_at)"
      },
      {
        filePath: "apps/api/src/postgres-room-store.ts",
        text: "export function hashSessionToken(sessionToken: string)"
      },
      {
        filePath: "apps/api/migrations/001_rooms_sessions.sql",
        text: "token_hash TEXT PRIMARY KEY"
      },
      { filePath: "apps/api/migrations/002_auth.sql", text: "token_hash TEXT PRIMARY KEY" },
      {
        filePath: "apps/api/test/auth-store.test.ts",
        text: "stores only hashed auth and magic-link tokens"
      },
      {
        filePath: "apps/api/test/postgres-room-store.test.ts",
        text: "persists room membership and hashed sessions across store instances"
      }
    ]
  },
  {
    claim: "Magic-link tokens are sent in URL fragments and verified through request bodies.",
    sources: [
      "apps/api/src/auth-store.ts",
      "apps/api/src/routes.ts",
      "apps/web/src/components/AuthMagicLinkVerifier.tsx",
      "apps/web/src/lib/api.ts"
    ],
    checks: [
      "apps/api/test/auth-store.test.ts",
      "apps/api/test/routes.test.ts",
      "apps/web/src/lib/api.test.ts",
      "scripts/check-privacy-evidence.mjs"
    ],
    commands: [
      "pnpm privacy:evidence",
      "pnpm --filter @cueroom/api test",
      "pnpm --filter @cueroom/web test"
    ],
    includes: [
      {
        filePath: "apps/api/src/auth-store.ts",
        text: "link.hash = `token=${encodeURIComponent(token)}`;"
      },
      { filePath: "apps/api/src/routes.ts", text: 'server.post("/v1/auth/magic-link/verify"' },
      {
        filePath: "apps/web/src/components/AuthMagicLinkVerifier.tsx",
        text: "readMagicLinkToken(window.location.hash)"
      },
      {
        filePath: "apps/web/src/components/AuthMagicLinkVerifier.tsx",
        text: "window.history.replaceState"
      },
      { filePath: "apps/web/src/lib/api.ts", text: '"/v1/auth/magic-link/verify"' },
      {
        filePath: "apps/web/src/lib/api.test.ts",
        text: "verifies magic links with the token in the JSON body, not the URL"
      },
      {
        filePath: "apps/api/test/auth-store.test.ts",
        text: 'expect(delivery?.magicLinkUrl).toContain("#token=cml_");'
      },
      {
        filePath: "apps/api/test/routes.test.ts",
        text: "does not expose magic-link tokens when SMTP delivery fails"
      }
    ]
  },
  {
    claim: "LiveKit JWTs are short-lived and held in browser memory only.",
    sources: [
      "apps/api/src/livekit.ts",
      "apps/api/src/routes.ts",
      "apps/web/src/components/useLiveKitCall.ts"
    ],
    checks: [
      "apps/api/test/livekit.test.ts",
      "apps/api/test/routes.test.ts",
      "apps/web/src/components/useLiveKitCall.test.tsx",
      "scripts/check-privacy-evidence.mjs"
    ],
    commands: [
      "pnpm privacy:evidence",
      "pnpm --filter @cueroom/api test",
      "pnpm --filter @cueroom/web test"
    ],
    includes: [
      { filePath: "apps/api/src/livekit.ts", text: 'ttl: "10m"' },
      { filePath: "apps/api/src/routes.ts", text: 'server.post("/v1/livekit/token"' },
      { filePath: "apps/web/src/components/useLiveKitCall.ts", text: "room.connect(url, token" },
      {
        filePath: "apps/web/src/components/useLiveKitCall.test.tsx",
        text: "without persisting the LiveKit token"
      },
      {
        filePath: "apps/api/test/routes.test.ts",
        text: "mints narrow LiveKit tokens only for the active room participant"
      }
    ],
    excludes: [
      { filePath: "apps/web/src/components/useLiveKitCall.ts", text: "localStorage" },
      { filePath: "apps/web/src/components/useLiveKitCall.ts", text: "sessionStorage" }
    ]
  },
  {
    claim:
      "CueRoom does not collect Netflix credentials, cookies, DRM keys, subtitles, screenshots, video, audio, or account data.",
    sources: [
      "apps/extension/src/manifest.json",
      "apps/extension/src/content-script.ts",
      "apps/extension/src/media-control.ts",
      "packages/shared/src/messages.ts",
      "packages/security/src/index.ts",
      "scripts/audit-extension.mjs"
    ],
    checks: [
      "apps/extension/test/manifest.test.ts",
      "apps/extension/test/media-control.test.ts",
      "packages/shared/src/messages.test.ts",
      "packages/security/src/index.test.ts",
      "scripts/check-privacy-evidence.mjs"
    ],
    commands: [
      "pnpm privacy:evidence",
      "pnpm security:extension",
      "pnpm --filter @cueroom/extension test",
      "pnpm --filter @cueroom/shared test",
      "pnpm --filter @cueroom/security test"
    ],
    includes: [
      {
        filePath: "apps/extension/src/manifest.json",
        text: '"host_permissions": ["https://www.netflix.com/watch/*"]'
      },
      { filePath: "apps/extension/src/content-script.ts", text: 'document.querySelector("video")' },
      {
        filePath: "apps/extension/src/content-script.ts",
        text: "const safeUrl = `${window.location.origin}/watch/${encodeURIComponent(getWatchId())}`;"
      },
      { filePath: "packages/shared/src/messages.ts", text: "playbackStateSchema" },
      { filePath: "packages/security/src/index.ts", text: "forbiddenExtensionPermissions" },
      { filePath: "scripts/audit-extension.mjs", text: "auditExtensionManifest" },
      {
        filePath: "apps/extension/test/manifest.test.ts",
        text: "does not request Netflix-sensitive permissions"
      },
      {
        filePath: "packages/shared/src/messages.test.ts",
        text: "accepts only sanitized Netflix watch URLs for playback state"
      }
    ],
    excludes: [
      { filePath: "apps/extension/src/content-script.ts", text: "document.cookie" },
      { filePath: "apps/extension/src/content-script.ts", text: "captureStream" },
      { filePath: "apps/extension/src/content-script.ts", text: "captureVisibleTab" },
      { filePath: "apps/extension/src/content-script.ts", text: "innerText" }
    ]
  }
];

for (const requirement of requiredEvidence) {
  const section = findClaimSection(requirement.claim);
  if (!section) {
    failures.push(`${evidencePath} missing evidence claim: ${requirement.claim}`);
    continue;
  }

  for (const sourcePath of requirement.sources) {
    requireExistingReferencedPath(section, sourcePath, "implementation source", requirement.claim);
  }
  for (const checkPath of requirement.checks) {
    requireExistingReferencedPath(section, checkPath, "test/check", requirement.claim);
  }
  for (const command of requirement.commands) {
    if (!section.includes(`\`${command}\``)) {
      failures.push(`${evidencePath} claim "${requirement.claim}" missing command: ${command}`);
    }
  }
  for (const include of requirement.includes ?? []) {
    requireSourceText(include.filePath, include.text, requirement.claim);
  }
  for (const exclude of requirement.excludes ?? []) {
    forbidSourceText(exclude.filePath, exclude.text, requirement.claim);
  }
}

if (failures.length > 0) {
  console.error(`Privacy implementation evidence check failed:\n${failures.join("\n")}`);
  process.exit(1);
}

console.info(`Privacy implementation evidence check passed for ${requiredEvidence.length} claims.`);

function findClaimSection(claim) {
  const marker = `- [x] Claim: ${claim}`;
  const start = evidence.indexOf(marker);
  if (start === -1) {
    return "";
  }
  const nextSection = evidence.indexOf("\n## ", start + marker.length);
  return evidence.slice(start, nextSection === -1 ? undefined : nextSection);
}

function requireExistingReferencedPath(section, filePath, kind, claim) {
  if (!existsSync(path.resolve(filePath))) {
    failures.push(`Missing ${kind} path for claim "${claim}": ${filePath}`);
    return;
  }
  if (!section.includes(`\`${filePath}\``)) {
    failures.push(`${evidencePath} claim "${claim}" missing ${kind} reference: ${filePath}`);
  }
}

function requireSourceText(filePath, text, claim) {
  const content = readText(filePath);
  if (!content.includes(text)) {
    failures.push(`${filePath} missing source evidence for claim "${claim}": ${text}`);
  }
}

function forbidSourceText(filePath, text, claim) {
  const content = readText(filePath);
  if (content.includes(text)) {
    failures.push(`${filePath} contains forbidden text for claim "${claim}": ${text}`);
  }
}

function readText(filePath) {
  return readFileSync(filePath, "utf8");
}
