import { describe, expect, it } from "vitest";
import { playbackStateSchema, syncCommandSchema, syncWarningSchema } from "./messages";

describe("message URL boundaries", () => {
  it("accepts only sanitized Netflix watch URLs for playback state", () => {
    expect(
      playbackStateSchema.safeParse({
        watchId: "81234567",
        titleHint: "Title",
        url: "https://www.netflix.com/watch/81234567",
        paused: true,
        currentTime: 1,
        duration: 10,
        playbackRate: 1,
        buffering: false,
        observedAt: 1,
        sequence: 1
      }).success
    ).toBe(true);

    expect(
      playbackStateSchema.safeParse({
        watchId: "81234567",
        url: "https://www.netflix.com/watch/81234567?tracking=1",
        paused: true,
        currentTime: 1,
        duration: 10,
        playbackRate: 1,
        buffering: false,
        observedAt: 1,
        sequence: 1
      }).success
    ).toBe(false);
  });

  it("rejects non-Netflix wrong-title navigation URLs", () => {
    expect(
      syncWarningSchema.safeParse({
        type: "wrong-title",
        roomId: "room_12345678",
        participantId: "participant_guest",
        expectedWatchId: "81234567",
        expectedUrl: "javascript:alert(1)",
        currentWatchId: "89999999",
        detectedAt: 1
      }).success
    ).toBe(false);
  });

  it("requires host sync commands to carry a target Netflix watch ID", () => {
    const command = {
      roomId: "room_12345678",
      actorId: "participant_host",
      watchId: "81234567",
      command: "pause",
      issuedAt: 1_779_984_000_000,
      sequence: 1
    };

    expect(syncCommandSchema.safeParse(command).success).toBe(true);
    expect(syncCommandSchema.safeParse({ ...command, watchId: "" }).success).toBe(false);
    const { watchId: _watchId, ...untargetedCommand } = command;
    expect(syncCommandSchema.safeParse(untargetedCommand).success).toBe(false);
  });
});
