import { mkdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDist = path.join(repoRoot, "apps/extension/dist");
const imageDir = path.join(repoRoot, "artifacts/chrome-web-store/images");
const port = await getAvailablePort();
const baseURL = `http://127.0.0.1:${port}`;
const storeReviewRoomId = "store-review-room";
const storeReviewExtensionId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

await mkdir(imageDir, { recursive: true });

async function getAvailablePort() {
  if (process.env.STORE_ASSET_WEB_PORT) {
    return process.env.STORE_ASSET_WEB_PORT;
  }

  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Unable to allocate a local port for store assets")));
        return;
      }

      server.close(() => resolve(String(address.port)));
    });
  });
}

function startWebServer() {
  const child = spawn(
    "pnpm",
    [
      "--filter",
      "@cueroom/web",
      "exec",
      "next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      port
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_ORIGIN: "http://127.0.0.1:4000"
      },
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return { child, getStderr: () => stderr };
}

async function waitForServer(getStderr) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    try {
      const response = await globalThis.fetch(baseURL);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Next is ready or the timeout expires.
    }
    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${baseURL}\n${getStderr()}`);
}

async function renderPromoTile(browser, options) {
  const page = await browser.newPage({
    viewport: { width: options.width, height: options.height },
    deviceScaleFactor: 1
  });
  const icon = await readFile(path.join(extensionDist, "icons/icon128.svg"), "utf8");
  await page.setContent(
    `<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; }
            html, body { margin: 0; width: ${options.width}px; height: ${options.height}px; overflow: hidden; }
            body {
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              color: #f7fbff;
              background:
                radial-gradient(circle at 18% 20%, rgba(45, 212, 191, 0.34), transparent 220px),
                radial-gradient(circle at 80% 72%, rgba(251, 113, 133, 0.22), transparent 260px),
                linear-gradient(135deg, #05070b 0%, #0b111c 52%, #020407 100%);
            }
            main {
              width: 100%;
              height: 100%;
              display: grid;
              grid-template-columns: ${options.width > 600 ? "1fr 0.85fr" : "1fr"};
              gap: ${options.width > 600 ? "48px" : "20px"};
              align-items: center;
              padding: ${options.width > 600 ? "56px 72px" : "28px"};
            }
            .brand { display: flex; align-items: center; gap: 18px; }
            .icon {
              width: ${options.width > 600 ? "88px" : "64px"};
              height: ${options.width > 600 ? "88px" : "64px"};
              display: grid;
              place-items: center;
              border-radius: 24px;
              background: rgba(255, 255, 255, 0.08);
              border: 1px solid rgba(255, 255, 255, 0.14);
              box-shadow: 0 28px 90px rgba(45, 212, 191, 0.22);
            }
            .icon svg { width: 72%; height: 72%; }
            h1 {
              margin: 0;
              font-size: ${options.width > 600 ? "72px" : "42px"};
              line-height: 0.95;
              letter-spacing: 0;
            }
            p {
              max-width: ${options.width > 600 ? "620px" : "330px"};
              margin: 22px 0 0;
              color: rgba(247, 251, 255, 0.72);
              font-size: ${options.width > 600 ? "28px" : "18px"};
              line-height: 1.32;
            }
            .panel {
              display: ${options.width > 600 ? "grid" : "none"};
              gap: 18px;
              min-height: 330px;
              padding: 24px;
              border-radius: 18px;
              border: 1px solid rgba(255, 255, 255, 0.12);
              background: rgba(255, 255, 255, 0.07);
              box-shadow: 0 28px 90px rgba(0, 0, 0, 0.36);
            }
            .video-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            .tile {
              min-height: 112px;
              border-radius: 14px;
              background: linear-gradient(135deg, rgba(45, 212, 191, 0.24), rgba(255, 255, 255, 0.07));
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            .chat {
              height: 86px;
              border-radius: 14px;
              background: rgba(255, 255, 255, 0.1);
              border: 1px solid rgba(255, 255, 255, 0.12);
            }
            .dock {
              height: 52px;
              border-radius: 999px;
              background: rgba(2, 6, 23, 0.78);
              border: 1px solid rgba(255, 255, 255, 0.16);
            }
          </style>
        </head>
        <body>
          <main>
            <section>
              <div class="brand">
                <div class="icon">${icon}</div>
                <h1>CueRoom</h1>
              </div>
              <p>Private watch rooms with video calls, chat, and local Netflix sync.</p>
            </section>
            <section class="panel" aria-hidden="true">
              <div class="video-grid">
                <div class="tile"></div>
                <div class="tile"></div>
              </div>
              <div class="chat"></div>
              <div class="dock"></div>
            </section>
          </main>
        </body>
      </html>`,
    { waitUntil: "load" }
  );
  await page.screenshot({ path: path.join(imageDir, options.fileName) });
  await page.close();
}

const server = startWebServer();
let browser;

try {
  await waitForServer(server.getStderr);
  browser = await chromium.launch();

  const storeReviewSession = {
    room: {
      id: storeReviewRoomId,
      inviteCode: "invite_store_123",
      title: "Friday watch room",
      locked: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      participants: [
        {
          id: "participant_host_0001",
          displayName: "You",
          role: "host",
          joinedAt: new Date().toISOString(),
          muted: false,
          cameraEnabled: true
        },
        {
          id: "participant_mira_0002",
          displayName: "Mira",
          role: "guest",
          joinedAt: new Date().toISOString(),
          muted: false,
          cameraEnabled: true
        },
        {
          id: "participant_dev_0003",
          displayName: "Dev",
          role: "guest",
          joinedAt: new Date().toISOString(),
          muted: true,
          cameraEnabled: false
        }
      ]
    },
    participant: {
      id: "participant_host_0001",
      displayName: "You",
      role: "host",
      joinedAt: new Date().toISOString(),
      muted: false,
      cameraEnabled: true
    },
    sessionToken: "crs_store_review_session_123456"
  };

  const roomPage = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1
  });
  await roomPage.route("**/v1/livekit/token", () => {
    // Keep the call token request pending while the store screenshot is captured.
  });
  await roomPage.addInitScript(
    ({ extensionId, roomId, session }) => {
      window.sessionStorage.setItem(`cueroom.roomSession.${roomId}`, JSON.stringify(session));
      window.localStorage.setItem("cueroom.extensionId", extensionId);
      Object.defineProperty(window, "chrome", {
        configurable: true,
        value: {
          runtime: {
            sendMessage: (_targetExtensionId, message, callback) => {
              if (message?.type === "GET_STATUS") {
                callback({
                  ok: true,
                  pairedRoomId: roomId,
                  playbackState: {
                    watchId: "81234567",
                    titleHint: "Demo title",
                    url: "https://www.netflix.com/watch/81234567",
                    paused: false,
                    currentTime: 742,
                    duration: 3600,
                    playbackRate: 1,
                    buffering: false,
                    observedAt: Date.now(),
                    sequence: 42
                  },
                  realtimeConnected: true,
                  syncWarning: null
                });
                return;
              }

              callback({ ok: true, tabPaired: true, realtime: true });
            }
          }
        }
      });
    },
    {
      extensionId: storeReviewExtensionId,
      roomId: storeReviewRoomId,
      session: storeReviewSession
    }
  );
  await roomPage.goto(`${baseURL}/room/${storeReviewRoomId}`, { waitUntil: "domcontentloaded" });
  await roomPage
    .getByText("Everyone is synced on the host's Netflix title.")
    .waitFor({ timeout: 5_000 });
  await roomPage.screenshot({
    path: path.join(imageDir, "room-ui-1280x800.png"),
    fullPage: false
  });
  await roomPage.close();

  const popupPage = await browser.newPage({
    viewport: { width: 640, height: 400 },
    deviceScaleFactor: 1
  });
  await popupPage.goto(`file://${path.join(extensionDist, "popup.html")}`);
  await popupPage.evaluate(() => {
    const setText = (selector, text) => {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = text;
      }
    };

    document.documentElement.style.background = "#05070b";
    document.body.style.margin = "38px auto";
    document.body.style.boxShadow = "0 28px 90px rgba(45, 212, 191, 0.22)";
    setText("#pairing", "Paired to room_store_review");
    setText("#playback", "Netflix detected: Demo title at 742s");
    setText("#warning", "No sync warnings");
  });
  await popupPage.screenshot({
    path: path.join(imageDir, "extension-popup-640x400.png"),
    fullPage: false
  });
  await popupPage.close();

  await renderPromoTile(browser, {
    width: 440,
    height: 280,
    fileName: "small-promo-440x280.png"
  });
  await renderPromoTile(browser, {
    width: 1400,
    height: 560,
    fileName: "marquee-promo-1400x560.png"
  });
} finally {
  await browser?.close();
  server.child.kill("SIGTERM");
}

console.info(`Chrome Web Store image assets written to ${imageDir}`);
