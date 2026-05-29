import { readFile } from "node:fs/promises";

const learnings = await readFile("LEARNINGS.md", "utf8");
const sourceMatches = [...learnings.matchAll(/^- \[[ x]\] Source:\s*(.+)$/gm)];
const staleByMatches = [...learnings.matchAll(/^\s*- Stale-by:\s*(\d{4}-\d{2}-\d{2})$/gm)];
const today = new Date();
const missingOrInvalid = [];
const stale = [];
const staleLanguageFindings = [];
const privacyPageFindings = [];
const privacyDisclosureFindings = [];

for (const [index, match] of sourceMatches.entries()) {
  const nextMatch = sourceMatches[index + 1];
  const block = learnings.slice(match.index, nextMatch?.index);
  if (!/^\s*- Stale-by:\s*\d{4}-\d{2}-\d{2}$/m.test(block)) {
    missingOrInvalid.push(match[1].trim());
  }
}

for (const match of staleByMatches) {
  const date = new Date(`${match[1]}T23:59:59Z`);
  if (date < today) {
    stale.push(match[1]);
  }
}

if (sourceMatches.length === 0) {
  console.error("No learning sources found in LEARNINGS.md.");
  process.exit(1);
}

if (missingOrInvalid.length > 0) {
  console.error(`Learning sources missing valid Stale-by dates: ${missingOrInvalid.join(", ")}`);
  process.exit(1);
}

if (stale.length > 0) {
  console.error(`Stale learning sources found: ${stale.join(", ")}`);
  process.exit(1);
}

for (const filePath of ["README.md", "AGENTS.md"]) {
  const content = await readFile(filePath, "utf8");
  const lines = content.split("\n");
  for (const [index, line] of lines.entries()) {
    if (/\b(?:skeleton|stubs?)\b/i.test(line)) {
      staleLanguageFindings.push(`${filePath}:${index + 1}: ${line.trim()}`);
    }
  }
}

const privacyPolicy = await readFile("PRIVACY.md", "utf8");
const privacyAnswers = await readFile("docs/release/chrome-web-store-privacy-answers.md", "utf8");
const privacyPage = await readFile("apps/web/src/app/privacy/page.tsx", "utf8");
const homePage = await readFile("apps/web/src/app/page.tsx", "utf8");
const privacyChecklistItems = [...privacyPolicy.matchAll(/^- \[x\] (.+)$/gm)].map(
  (match) => match[1]
);
const privacyBoundaryItems = privacyChecklistItems.filter(
  (item) =>
    /^No Netflix .+\.$/.test(item) ||
    item === "No call recording." ||
    item === "No advertising identifiers."
);

if (privacyBoundaryItems.length < 8) {
  privacyPageFindings.push(
    "PRIVACY.md must keep the complete no-sensitive-data boundary checklist."
  );
}

for (const privacyBoundaryItem of privacyBoundaryItems) {
  if (!normalizedIncludes(privacyPage, privacyBoundaryItem)) {
    privacyPageFindings.push(`apps/web/src/app/privacy/page.tsx missing: ${privacyBoundaryItem}`);
  }
}

for (const privacyChecklistItem of privacyChecklistItems) {
  if (!normalizedIncludes(privacyPage, privacyChecklistItem)) {
    privacyPageFindings.push(
      `apps/web/src/app/privacy/page.tsx missing policy checklist item: ${privacyChecklistItem}`
    );
  }
}

for (const requiredPrivacyText of [
  "Chrome Web Store Limited Use",
  "CueRoom's use of information received from Chrome extension APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.",
  "CueRoom does not sell personal data, use personal data for targeted advertising, or transfer extension user data to advertising platforms or data brokers."
]) {
  if (!normalizedIncludes(privacyPage, requiredPrivacyText)) {
    privacyPageFindings.push(`apps/web/src/app/privacy/page.tsx missing: ${requiredPrivacyText}`);
  }
}

for (const requirement of [
  {
    policy:
      "Account data: optional email address or passkey credential metadata for hosts who sign in.",
    answers:
      "Personally identifiable information: Yes, only when a host chooses account auth. CueRoom may handle an email address or passkey credential metadata for authentication."
  },
  {
    policy:
      "Room data: room IDs, invite codes, participant display names, participant roles, room lock state, and short-lived room session tokens.",
    answers:
      "User activity: Yes, limited to room IDs, invite codes, participant display names, participant roles, room lock state, room presence, sync state, call metadata, transient chat state, abuse report metadata, minimal audit events, and rate-limit state needed to provide and protect private co-watch rooms."
  },
  {
    policy:
      "Playback sync metadata: Netflix watch URL fingerprint, title hint, paused state, current time, duration, playback rate, buffering state, timestamp, and sequence number.",
    answers:
      "Website content: Yes. CueRoom reads only Netflix watch-page playback metadata needed for sync: watch URL fingerprint, title hint, paused state, current time, duration, playback rate, buffering state, timestamp, and sequence number."
  },
  {
    policy:
      "Chat data: in-room chat messages while the room is active. Chat is not persisted by default.",
    answers:
      "User communications: Yes, room chat messages while a room is active; chat is not persisted by default."
  },
  {
    policy:
      "Abuse report data: reporter participant ID, reported participant ID, reason, optional bounded details, room ID, and timestamp when a participant submits a room report.",
    answers: "abuse report metadata"
  },
  {
    policy:
      "CueRoom does not sell personal data, use personal data for targeted advertising, or transfer extension user data to advertising platforms or data brokers.",
    answers: "Do not sell data."
  },
  {
    policy: "CueRoom does not use or transfer extension data for personalized advertising.",
    answers: "CueRoom does not use or transfer extension data for personalized advertising."
  },
  {
    policy:
      "CueRoom's use of information received from Chrome extension APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.",
    answers: "Limited Use disclosure appears in `PRIVACY.md`."
  },
  {
    policy: "No Netflix credentials.",
    answers:
      "Do not transfer Netflix credentials, cookies, DRM keys, subtitles, screenshots, frames, video, audio, or Netflix account data."
  },
  {
    policy: "No Netflix screenshots, frames, video, or audio.",
    answers:
      "Do not transfer Netflix credentials, cookies, DRM keys, subtitles, screenshots, frames, video, audio, or Netflix account data."
  }
]) {
  if (!normalizedIncludes(privacyPolicy, requirement.policy)) {
    privacyDisclosureFindings.push(`PRIVACY.md missing: ${requirement.policy}`);
  }
  if (!normalizedIncludes(privacyAnswers, requirement.answers)) {
    privacyDisclosureFindings.push(
      `docs/release/chrome-web-store-privacy-answers.md missing: ${requirement.answers}`
    );
  }
}

if (!homePage.includes('href="/privacy"')) {
  privacyPageFindings.push("apps/web/src/app/page.tsx must link to /privacy from the home page.");
}

if (staleLanguageFindings.length > 0) {
  console.error(
    `Source-of-truth docs contain stale scaffold language:\n${staleLanguageFindings.join("\n")}`
  );
  process.exit(1);
}

if (privacyPageFindings.length > 0) {
  console.error(`Privacy route drift found:\n${privacyPageFindings.join("\n")}`);
  process.exit(1);
}

if (privacyDisclosureFindings.length > 0) {
  console.error(`Privacy disclosure parity drift found:\n${privacyDisclosureFindings.join("\n")}`);
  process.exit(1);
}

console.info(`Docs freshness check passed for ${sourceMatches.length} sources.`);

function normalizedIncludes(content, expectedText) {
  return normalizePolicyText(content).includes(normalizePolicyText(expectedText));
}

function normalizePolicyText(value) {
  return value.replaceAll("`", "").replace(/\s+/g, " ").trim();
}
