async function refreshPopup() {
  const stored = await chrome.storage.local.get([
    "pairedRoom",
    "latestPlaybackState",
    "latestSyncWarning"
  ]);
  const pairing = document.querySelector("#pairing");
  const playback = document.querySelector("#playback");
  const warning = document.querySelector("#warning");

  if (pairing) {
    const room = stored["pairedRoom"] as { roomId?: string } | undefined;
    pairing.textContent = room?.roomId ? `Paired to ${room.roomId}` : "Not paired to a room";
  }

  if (playback) {
    const state = stored["latestPlaybackState"] as
      | { titleHint?: string; currentTime?: number }
      | undefined;
    playback.textContent = state
      ? `Netflix detected: ${state.titleHint ?? "Untitled"} at ${Math.floor(state.currentTime ?? 0)}s`
      : "Open a Netflix watch page to sync";
  }

  if (warning) {
    const syncWarning = stored["latestSyncWarning"] as
      | { expectedTitleHint?: string; expectedWatchId?: string }
      | undefined;
    warning.textContent = syncWarning
      ? `Wrong title: open ${syncWarning.expectedTitleHint ?? syncWarning.expectedWatchId ?? "the host title"}`
      : "No sync warnings";
  }
}

document.querySelector("#disconnect")?.addEventListener("click", () => {
  void chrome.runtime
    .sendMessage({ type: "UNPAIR_ROOM" })
    .catch(() => chrome.storage.local.remove(["pairedRoom", "latestSyncWarning"]))
    .then(refreshPopup);
});

void refreshPopup();
