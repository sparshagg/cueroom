import { syncCommandSchema, syncCorrectionSchema, type SyncCommand } from "@cueroom/shared";
import { applySyncCommandToVideo, applySyncCorrectionToVideo } from "./media-control";

let sequence = 0;
let lastFingerprint = "";

function getVideo() {
  return document.querySelector("video");
}

function getWatchId() {
  const match = window.location.pathname.match(/\/watch\/([^/?#]+)/);
  return match?.[1] ?? window.location.pathname;
}

function readPlaybackState() {
  const video = getVideo();
  if (!video) {
    return null;
  }

  const safeUrl = `${window.location.origin}/watch/${encodeURIComponent(getWatchId())}`;
  lastFingerprint = getWatchId();
  return {
    watchId: lastFingerprint,
    titleHint: document.title.replace(" - Netflix", "").slice(0, 160),
    url: safeUrl,
    paused: video.paused,
    currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    playbackRate: Number.isFinite(video.playbackRate) ? video.playbackRate : 1,
    buffering: video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA,
    observedAt: Date.now(),
    sequence: sequence++
  };
}

function publishPlaybackState() {
  const state = readPlaybackState();
  if (!state) {
    return;
  }
  void chrome.runtime.sendMessage({ type: "PLAYBACK_STATE", state }).catch(() => undefined);
}

function applySyncCommand(command: SyncCommand) {
  const video = getVideo();
  if (!video) {
    return;
  }

  applySyncCommandToVideo(video, command);
}

function applySyncCorrection(correction: unknown) {
  const parsed = syncCorrectionSchema.safeParse(correction);
  const video = getVideo();
  if (!parsed.success || !video) {
    return false;
  }
  return applySyncCorrectionToVideo(video, parsed.data, getWatchId());
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (typeof message !== "object" || message === null || !("type" in message)) {
    sendResponse({ ok: false });
    return false;
  }

  if (message.type === "APPLY_SYNC_COMMAND" && "command" in message) {
    const parsed = syncCommandSchema.safeParse(message.command);
    if (!parsed.success) {
      sendResponse({ ok: false });
      return false;
    }
    applySyncCommand(parsed.data);
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "APPLY_SYNC_CORRECTION" && "correction" in message) {
    sendResponse({ ok: applySyncCorrection(message.correction) });
    return false;
  }

  sendResponse({ ok: false });
  return false;
});

const observer = new MutationObserver(() => {
  const currentFingerprint = getWatchId();
  if (currentFingerprint !== lastFingerprint) {
    publishPlaybackState();
  }
});

observer.observe(document.documentElement, {
  subtree: true,
  childList: true
});

window.addEventListener("play", publishPlaybackState, true);
window.addEventListener("pause", publishPlaybackState, true);
window.addEventListener("seeking", publishPlaybackState, true);
window.addEventListener("waiting", publishPlaybackState, true);
window.addEventListener("playing", publishPlaybackState, true);

setInterval(publishPlaybackState, 2_000);
publishPlaybackState();
