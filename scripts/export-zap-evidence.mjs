import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

const zapOrigin = normalizeOrigin(process.env.DAST_ZAP_ORIGIN ?? "http://127.0.0.1:8090");
const outputDir = path.resolve(process.env.DAST_OUTPUT_DIR ?? "artifacts/dast");
const requireCoverage = process.env.DAST_REQUIRE_AUTHENTICATED_ZAP !== "false";

const webBaseUrl = normalizeOrigin(process.env.DAST_WEB_ORIGIN ?? "http://127.0.0.1:3000");
const apiBaseUrl = normalizeOrigin(process.env.DAST_API_ORIGIN ?? "http://127.0.0.1:4000");

await mkdir(outputDir, { recursive: true });

try {
  const remainingRecords = await waitForPassiveScan();
  const urls = await fetchZapJson("/JSON/core/view/urls/");
  const webAlerts = await fetchZapJson("/JSON/core/view/alerts/", { baseurl: webBaseUrl });
  const apiAlerts = await fetchZapJson("/JSON/core/view/alerts/", { baseurl: apiBaseUrl });

  const rawUrls = Array.isArray(urls.urls) ? urls.urls : [];
  const localUrls = rawUrls.filter((url) => isCueRoomTargetUrl(safeUrl(url)));
  const coverage = summarizeCoverage(localUrls);
  if (requireCoverage) {
    assertRequiredCoverage(coverage);
  }

  await writeJson("passive-records-to-scan.json", sanitize({ recordsToScan: remainingRecords }));
  await writeJson("authenticated-zap-urls.json", sanitize({ urls: localUrls }));
  await writeJson("authenticated-alerts-web.json", sanitize(webAlerts));
  await writeJson("authenticated-alerts-api.json", sanitize(apiAlerts));
  await writeJson(
    "authenticated-zap-summary.json",
    sanitize({
      ok: true,
      generatedAt: new Date().toISOString(),
      zapOrigin,
      coverage,
      webAlertCount: Array.isArray(webAlerts.alerts) ? webAlerts.alerts.length : 0,
      apiAlertCount: Array.isArray(apiAlerts.alerts) ? apiAlerts.alerts.length : 0,
      rawProxyTrafficUploaded: false,
      sensitiveValueRedaction: [
        "room session tokens",
        "account session tokens",
        "magic-link tokens",
        "invite codes",
        "room ids",
        "participant ids",
        "report ids",
        "report details"
      ]
    })
  );
} catch (error) {
  await writeJson(
    "authenticated-zap-summary.json",
    sanitize({
      ok: false,
      generatedAt: new Date().toISOString(),
      zapOrigin,
      error: error instanceof Error ? error.message : String(error),
      rawProxyTrafficUploaded: false
    })
  );
  throw error;
}

async function waitForPassiveScan() {
  let remainingRecords = null;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await fetchZapJson("/JSON/pscan/view/recordsToScan/");
    remainingRecords = Number(result.recordsToScan ?? 0);
    if (remainingRecords === 0) {
      return remainingRecords;
    }
    await setTimeout(2_000);
  }
  return remainingRecords;
}

async function fetchZapJson(endpoint, searchParams = {}) {
  const url = new URL(endpoint, zapOrigin);
  for (const [key, value] of Object.entries(searchParams)) {
    url.searchParams.set(key, value);
  }
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    throw new Error(`ZAP API request failed for ${endpoint}: ${response.status}`);
  }
  return response.json();
}

function summarizeCoverage(urls) {
  return {
    webHome: urls.some((url) => safeUrl(url)?.pathname === "/"),
    webJoin: urls.some((url) => /^\/join\/[A-Za-z0-9_-]{8,}$/.test(safeUrl(url)?.pathname ?? "")),
    webRoom: urls.some((url) => /^\/room\/room_[^/]+$/.test(safeUrl(url)?.pathname ?? "")),
    apiCreateRoom: urls.some((url) => safeUrl(url)?.pathname === "/v1/rooms"),
    apiJoinRoom: urls.some((url) => safeUrl(url)?.pathname === "/v1/rooms/join"),
    apiReportUser: urls.some((url) =>
      /^\/v1\/rooms\/room_[^/]+\/report$/.test(safeUrl(url)?.pathname ?? "")
    )
  };
}

function assertRequiredCoverage(coverage) {
  const missing = Object.entries(coverage)
    .filter(([, covered]) => !covered)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`ZAP did not observe required authenticated flow URLs: ${missing.join(", ")}`);
  }
}

function sanitize(value) {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

function redactString(value) {
  return value
    .replace(/\b(?:crs|cas|cml)_[A-Za-z0-9._-]+/g, "{redacted-token}")
    .replace(/\breport_[0-9a-f-]{36}\b/g, "report_{id}")
    .replace(/\broom_[0-9a-f-]{36}\b/g, "room_{id}")
    .replace(/\bp_[0-9a-f-]{36}\b/g, "p_{id}")
    .replace(/\/join\/[A-Za-z0-9_-]{8,}/g, "/join/{inviteCode}")
    .replace(/"inviteCode"\s*:\s*"[^"]+"/g, '"inviteCode":"{inviteCode}"')
    .replace(/DAST bounded smoke report; no user content\./g, "{redacted-report-details}");
}

async function writeJson(fileName, value) {
  await writeFile(path.join(outputDir, fileName), `${JSON.stringify(value, null, 2)}\n`);
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
  return url !== null && (url.origin === webBaseUrl || url.origin === apiBaseUrl);
}
