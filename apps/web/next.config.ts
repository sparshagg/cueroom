import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  `connect-src ${buildConnectSources().join(" ")}`,
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:"
].join("; ");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), fullscreen=(self)"
          }
        ]
      }
    ];
  },
  transpilePackages: ["@cueroom/shared", "@cueroom/ui"]
};

export default nextConfig;

function buildConnectSources() {
  return [
    "'self'",
    "http://localhost:4000",
    "ws://localhost:4000",
    "ws://localhost:7880",
    "wss://localhost:7880",
    ...readCspSources(process.env.NEXT_PUBLIC_API_ORIGIN),
    ...readCspSources(process.env.NEXT_PUBLIC_LIVEKIT_URL),
    ...readCspSources(process.env.NEXT_PUBLIC_CSP_CONNECT_SRC)
  ].filter((source, index, sources) => sources.indexOf(source) === index);
}

function readCspSources(value: string | undefined) {
  return (value ?? "")
    .split(/[,\s]+/)
    .map(normalizeCspSource)
    .filter((source): source is string => Boolean(source));
}

function normalizeCspSource(source: string) {
  const trimmed = source.trim();
  if (!trimmed || /[\s;]/.test(trimmed)) {
    return undefined;
  }
  if (trimmed.includes("*")) {
    return /^(https?|wss?):\/\//.test(trimmed) ? trimmed : undefined;
  }
  try {
    const url = new URL(trimmed);
    return /^(https?|wss?):$/.test(url.protocol) ? url.origin : undefined;
  } catch {
    return trimmed === "'self'" ? trimmed : undefined;
  }
}
