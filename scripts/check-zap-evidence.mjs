import { readFile } from "node:fs/promises";
import path from "node:path";

const outputDir = path.resolve(process.env.DAST_OUTPUT_DIR ?? "artifacts/dast");
const failOnRisk = process.env.DAST_FAIL_ON_RISK?.trim() || "Medium";
const riskRanks = new Map([
  ["informational", 0],
  ["info", 0],
  ["low", 1],
  ["medium", 2],
  ["high", 3],
  ["critical", 4]
]);

const summary = await readJson("authenticated-zap-summary.json");
const webAlerts = await readJson("authenticated-alerts-web.json");
const apiAlerts = await readJson("authenticated-alerts-api.json");

assertSummaryOk(summary);
const blockingAlerts = findBlockingAlerts(
  [
    ...readAlerts(webAlerts).map((alert) => ({ ...alert, surface: "web" })),
    ...readAlerts(apiAlerts).map((alert) => ({ ...alert, surface: "api" }))
  ],
  failOnRisk
);

if (blockingAlerts.length > 0) {
  throw new Error(
    `Authenticated ZAP evidence contains ${blockingAlerts.length} alert(s) at ${failOnRisk} or higher: ${blockingAlerts
      .map((alert) => `${alert.surface}:${alert.risk}:${alert.name}:${alert.url ?? ""}`)
      .join("; ")}`
  );
}

console.info(
  `Authenticated ZAP evidence check passed: ${summary.webAlertCount ?? 0} web alert(s), ${
    summary.apiAlertCount ?? 0
  } API alert(s), no ${failOnRisk}+ findings.`
);

async function readJson(fileName) {
  return JSON.parse(await readFile(path.join(outputDir, fileName), "utf8"));
}

function assertSummaryOk(summary) {
  if (summary.ok !== true) {
    throw new Error(
      `Authenticated ZAP summary is not ok: ${summary.error ?? "unknown summary failure"}`
    );
  }
  const coverage = summary.coverage;
  if (!coverage || typeof coverage !== "object") {
    throw new Error("Authenticated ZAP summary did not include coverage.");
  }
  const missingCoverage = Object.entries(coverage)
    .filter(([, covered]) => covered !== true)
    .map(([name]) => name);
  if (missingCoverage.length > 0) {
    throw new Error(`Authenticated ZAP coverage is incomplete: ${missingCoverage.join(", ")}`);
  }
  if (summary.rawProxyTrafficUploaded !== false) {
    throw new Error("Authenticated ZAP summary must confirm raw proxy traffic was not uploaded.");
  }
}

function readAlerts(value) {
  return Array.isArray(value.alerts) ? value.alerts : [];
}

function findBlockingAlerts(alerts, threshold) {
  const thresholdRank = riskRank(threshold);
  if (thresholdRank === null) {
    throw new Error(`Unsupported DAST_FAIL_ON_RISK value: ${threshold}`);
  }
  return alerts.filter((alert) => {
    const rank = riskRank(alert.risk);
    return rank !== null && rank >= thresholdRank;
  });
}

function riskRank(value) {
  if (typeof value !== "string") {
    return null;
  }
  return riskRanks.get(value.trim().toLowerCase()) ?? null;
}
