import type { SyncCommand, SyncCorrection } from "@cueroom/shared";

type ControlledVideo = {
  currentTime: number;
  playbackRate: number;
  pause(): void;
  play(): Promise<void>;
};

export function applySyncCommandToVideo(video: ControlledVideo, command: SyncCommand) {
  if (typeof command.playbackRate === "number" && Number.isFinite(command.playbackRate)) {
    video.playbackRate = command.playbackRate;
  }

  if (typeof command.position === "number" && Number.isFinite(command.position)) {
    video.currentTime = Math.max(0, command.position);
  }

  if (command.command === "play" || command.command === "catch-up") {
    void video.play().catch(() => undefined);
  }

  if (command.command === "pause") {
    video.pause();
  }
}

export function applySyncCorrectionToVideo(
  video: ControlledVideo,
  correction: SyncCorrection,
  currentWatchId: string
) {
  if (correction.watchId !== currentWatchId) {
    return false;
  }

  if (typeof correction.playbackRate === "number" && Number.isFinite(correction.playbackRate)) {
    video.playbackRate = correction.playbackRate;
  }

  if (typeof correction.position === "number" && Number.isFinite(correction.position)) {
    video.currentTime = Math.max(0, correction.position);
  }

  if (correction.command === "catch-up") {
    void video.play().catch(() => undefined);
  }

  if (correction.command === "pause") {
    video.pause();
  }

  return true;
}
