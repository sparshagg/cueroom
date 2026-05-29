import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const webOrigin = normalizeOrigin(process.env.DAST_WEB_ORIGIN ?? "http://127.0.0.1:3000");
const apiOrigin = normalizeOrigin(
  process.env.DAST_API_ORIGIN ?? process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:4000"
);
const proxyServer = process.env.DAST_PROXY?.trim();
const outputDir = path.resolve(process.env.DAST_OUTPUT_DIR ?? "artifacts/dast");
const outputPath = path.join(outputDir, "authenticated-flow.json");
const reportDetails = "DAST bounded smoke report; no user content.";

const observedRequests = new Set();

async function main() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    ...(proxyServer
      ? {
          args: ["--proxy-bypass-list=<-loopback>"],
          proxy: { server: proxyServer }
        }
      : {})
  });

  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      serviceWorkers: "block"
    });
    await context.addInitScript({
      content: `
        window.WebSocket = class DastBlockedWebSocket extends EventTarget {
          static CONNECTING = 0;
          static OPEN = 1;
          static CLOSING = 2;
          static CLOSED = 3;

          binaryType = "blob";
          bufferedAmount = 0;
          extensions = "";
          onclose = null;
          onerror = null;
          onmessage = null;
          onopen = null;
          protocol = "";
          readyState = DastBlockedWebSocket.CLOSED;
          url;

          constructor(url) {
            super();
            this.url = String(url);
            window.setTimeout(() => {
              const event = new Event("close");
              this.onclose?.(event);
              this.dispatchEvent(event);
            }, 0);
          }

          close() {}
          send() {}
        };
      `
    });
    await context.route("**/*", (route) => {
      const url = safeUrl(route.request().url());
      if (url?.origin === apiOrigin && url.pathname === "/v1/livekit/token") {
        return route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify({
            url: "ws://127.0.0.1:9",
            token: "dast-livekit-token-not-real"
          })
        });
      }
      if (url && isCueRoomTargetUrl(url)) {
        return route.continue();
      }
      return route.abort();
    });

    const hostPage = await context.newPage();
    captureRequests(hostPage);
    await hostPage.goto(webOrigin, { waitUntil: "load" });
    await hostPage.waitForLoadState("networkidle");
    await hostPage.getByRole("textbox", { name: "Host name" }).fill("DAST Host");
    await hostPage.getByRole("textbox", { name: "Room title" }).fill("DAST Report Room");

    const createResponse = waitForApiPost(hostPage, "/v1/rooms");
    await hostPage.getByRole("button", { name: /^Create$/ }).click();
    await assertOk(await createResponse, "room creation");
    await hostPage.waitForURL(/\/room\/room_/, { timeout: 15_000 });
    const hostSession = await readSingleRoomSession(hostPage);

    const guestPage = await context.newPage();
    captureRequests(guestPage);
    await guestPage.goto(`${webOrigin}/join/${encodeURIComponent(hostSession.room.inviteCode)}`, {
      waitUntil: "load"
    });
    await guestPage.waitForLoadState("networkidle");
    await guestPage.getByRole("textbox", { name: "Display name" }).fill("DAST Guest");

    const joinResponse = waitForApiPost(guestPage, "/v1/rooms/join");
    await guestPage.getByRole("button", { name: /Continue to lobby/i }).click();
    await assertOk(await joinResponse, "room join");
    await guestPage.waitForURL(new RegExp(`/room/${escapeRegExp(hostSession.room.id)}$`), {
      timeout: 15_000
    });
    const guestSession = await readSingleRoomSession(guestPage);
    if (guestSession.room.id !== hostSession.room.id) {
      throw new Error("Guest joined an unexpected room.");
    }
    if (guestSession.room.participants.length < 2) {
      throw new Error("Guest session did not include a reportable participant.");
    }

    await guestPage.getByRole("button", { name: "Report participant" }).click();
    await guestPage.getByRole("combobox", { name: "Report reason" }).selectOption("spam");
    await guestPage.getByRole("textbox", { name: "Report details" }).fill(reportDetails);

    const reportResponse = waitForApiPost(guestPage, `/v1/rooms/${guestSession.room.id}/report`);
    await guestPage.getByRole("button", { name: /Submit report/i }).click();
    const report = await assertOk(await reportResponse, "participant report");
    if (JSON.stringify(report).includes(reportDetails)) {
      throw new Error("Report response exposed free-text details.");
    }
    assertObservedEndpoints();

    await writeEvidence({
      ok: true,
      generatedAt: new Date().toISOString(),
      webOrigin,
      apiOrigin,
      proxyEnabled: Boolean(proxyServer),
      participantCount: guestSession.room.participants.length,
      reportCreated: Boolean(report.report?.id),
      observedRequestPaths: observedRequestPaths()
    });
  } finally {
    await browser.close();
  }
}

function captureRequests(page) {
  page.on("request", (request) => {
    const url = safeUrl(request.url());
    if (!url || !shouldRecordRequest(url)) {
      return;
    }
    observedRequests.add(`${request.method()} ${url.origin}${redactPath(url.pathname)}`);
  });
}

function waitForApiPost(page, pathname) {
  return page.waitForResponse(
    (response) => {
      const url = safeUrl(response.url());
      return Boolean(
        url && url.pathname === pathname && response.request().method().toUpperCase() === "POST"
      );
    },
    { timeout: 45_000 }
  );
}

async function assertOk(response, label) {
  const bodyText = await response.text();
  if (!response.ok()) {
    throw new Error(`${label} failed with ${response.status()}: ${bodyText}`);
  }
  try {
    return JSON.parse(bodyText);
  } catch {
    return {};
  }
}

async function readSingleRoomSession(page) {
  const sessions = await page.evaluate(() =>
    Object.entries(window.sessionStorage)
      .filter(([key]) => key.startsWith("cueroom.roomSession."))
      .map(([, value]) => JSON.parse(value))
  );
  if (sessions.length !== 1) {
    throw new Error(`Expected one room session, found ${sessions.length}.`);
  }
  return sessions[0];
}

async function writeEvidence(evidence) {
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function observedRequestPaths() {
  return [...observedRequests].sort();
}

function assertObservedEndpoints() {
  const observed = observedRequestPaths();
  const required = [
    `POST ${apiOrigin}/v1/rooms`,
    `POST ${apiOrigin}/v1/rooms/join`,
    `POST ${apiOrigin}/v1/rooms/{roomId}/report`
  ];
  const missing = required.filter((requestPath) => !observed.includes(requestPath));
  if (missing.length > 0) {
    throw new Error(`Authenticated DAST flow missed required requests: ${missing.join(", ")}`);
  }
}

function normalizeOrigin(value) {
  const url = new URL(value);
  return url.origin;
}

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isCueRoomTargetUrl(url) {
  return url.origin === webOrigin || url.origin === apiOrigin;
}

function shouldRecordRequest(url) {
  if (url.origin === apiOrigin) {
    return url.pathname !== "/v1/livekit/token";
  }
  return (
    url.origin === webOrigin &&
    (url.pathname === "/" || url.pathname.startsWith("/join/") || url.pathname.startsWith("/room/"))
  );
}

function redactPath(pathname) {
  return pathname
    .replace(/^\/join\/[A-Za-z0-9_-]{8,}$/, "/join/{inviteCode}")
    .replace(/^\/room\/room_[^/]+$/, "/room/{roomId}")
    .replace(/^\/v1\/rooms\/room_[^/]+$/, "/v1/rooms/{roomId}")
    .replace(/^\/v1\/rooms\/room_[^/]+\/report$/, "/v1/rooms/{roomId}/report")
    .replace(/^\/v1\/rooms\/room_[^/]+\/realtime$/, "/v1/rooms/{roomId}/realtime");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch(async (error) => {
  await mkdir(outputDir, { recursive: true });
  await writeEvidence({
    ok: false,
    generatedAt: new Date().toISOString(),
    webOrigin,
    apiOrigin,
    proxyEnabled: Boolean(proxyServer),
    error: error instanceof Error ? error.message : String(error),
    observedRequestPaths: observedRequestPaths()
  });
  console.error(error);
  process.exit(1);
});
