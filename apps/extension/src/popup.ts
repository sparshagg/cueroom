async function refreshPopup() {
  const stored = await chrome.storage.local.get(["pairedRoom", "latestPlaybackState"]);
  const pairing = document.querySelector("#pairing");
  const playback = document.querySelector("#playback");

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
}

document.querySelector("#disconnect")?.addEventListener("click", () => {
  void chrome.storage.local.remove("pairedRoom").then(refreshPopup);
});

void refreshPopup();
