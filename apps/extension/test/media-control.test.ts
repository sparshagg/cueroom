import type { SyncCommand, SyncCorrection } from "@cueroom/shared";
import { describe, expect, it, vi } from "vitest";
import { applySyncCommandToVideo, applySyncCorrectionToVideo } from "../src/media-control";

describe("applySyncCommandToVideo", () => {
  it("applies host commands only when the current Netflix watch ID matches", () => {
    const video = fakeVideo();

    expect(applySyncCommandToVideo(video, command, "81234567")).toBe(true);

    expect(video.currentTime).toBe(122.5);
    expect(video.playbackRate).toBe(1);
    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(video.play).not.toHaveBeenCalled();
  });

  it("does not mutate playback when a host command targets a different watch ID", () => {
    const video = fakeVideo();

    expect(applySyncCommandToVideo(video, command, "89999999")).toBe(false);

    expect(video.currentTime).toBe(10);
    expect(video.playbackRate).toBe(1);
    expect(video.play).not.toHaveBeenCalled();
    expect(video.pause).not.toHaveBeenCalled();
  });
});

describe("applySyncCorrectionToVideo", () => {
  it("applies targeted correction when the current Netflix watch ID matches", () => {
    const video = fakeVideo();

    expect(applySyncCorrectionToVideo(video, correction, "81234567")).toBe(true);

    expect(video.currentTime).toBe(122.5);
    expect(video.playbackRate).toBe(1);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(video.pause).not.toHaveBeenCalled();
  });

  it("does not mutate playback when the current Netflix watch ID differs", () => {
    const video = fakeVideo();

    expect(applySyncCorrectionToVideo(video, correction, "89999999")).toBe(false);

    expect(video.currentTime).toBe(10);
    expect(video.playbackRate).toBe(1);
    expect(video.play).not.toHaveBeenCalled();
    expect(video.pause).not.toHaveBeenCalled();
  });
});

const correction: SyncCorrection = {
  roomId: "room_12345678",
  participantId: "participant_guest",
  authorityParticipantId: "participant_host",
  watchId: "81234567",
  command: "catch-up",
  position: 122.5,
  playbackRate: 1,
  driftSeconds: 4.5,
  issuedAt: 1_779_984_000_000
};

const command: SyncCommand = {
  roomId: "room_12345678",
  actorId: "participant_host",
  watchId: "81234567",
  command: "pause",
  position: 122.5,
  playbackRate: 1,
  issuedAt: 1_779_984_000_000,
  sequence: 1
};

function fakeVideo() {
  return {
    currentTime: 10,
    playbackRate: 1,
    pause: vi.fn(),
    play: vi.fn(async () => undefined)
  };
}
