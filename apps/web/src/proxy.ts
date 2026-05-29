import { NextResponse, type NextRequest } from "next/server";
import { createCspNonce } from "@/lib/csp";

export function proxy(request: NextRequest) {
  const nonce = createCspNonce();
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|brand/|icons/|manifest.json).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
};

function buildContentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    "base-uri 'none'",
    `connect-src ${buildConnectSources().join(" ")}`,
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' ${isDev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "worker-src 'self' blob:"
  ].join("; ");
}

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
