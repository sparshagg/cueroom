import type { RoomSession } from "@cueroom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getExtensionStatus, pairExtension } from "./extension";

const originalTrustedExtensionId = process.env.NEXT_PUBLIC_CUEROOM_EXTENSION_ID;

afterEach(() => {
  if (originalTrustedExtensionId === undefined) {
    delete process.env.NEXT_PUBLIC_CUEROOM_EXTENSION_ID;
  } else {
    process.env.NEXT_PUBLIC_CUEROOM_EXTENSION_ID = originalTrustedExtensionId;
  }
});

describe("pairExtension", () => {
  it("sends only room-scoped pairing details to the configured extension", async () => {
    const runtime = {
      sendMessage: vi.fn(
        (_extensionId: string, _message: unknown, callback: (response: unknown) => void) => {
          callback({ ok: true, tabPaired: true, realtime: true });
        }
      )
    };

    await expect(
      pairExtension(roomSession, "extension_id", {
        apiOrigin: "http://localhost:4000",
        runtime
      })
    ).resolves.toEqual({ ok: true, tabPaired: true, realtime: true });

    expect(runtime.sendMessage).toHaveBeenCalledWith(
      "extension_id",
      {
        type: "PAIR_ROOM",
        roomId: "room_12345678",
        participantId: "participant_host",
        sessionToken: "crs_123456789012345678901234",
        appOrigin: "http://localhost:3000",
        apiOrigin: "http://localhost:4000"
      },
      expect.any(Function)
    );
  });

  it("rejects unexpected extension responses", async () => {
    const runtime = {
      sendMessage: vi.fn(
        (_extensionId: string, _message: unknown, callback: (response: unknown) => void) => {
          callback({ tabPaired: true });
        }
      )
    };

    await expect(pairExtension(roomSession, "extension_id", { runtime })).rejects.toThrow(
      "Unexpected extension response"
    );
  });

  it("does not send room session tokens to untrusted configured extension ids", async () => {
    process.env.NEXT_PUBLIC_CUEROOM_EXTENSION_ID = "trusted_extension_id";
    const runtime = {
      sendMessage: vi.fn()
    };

    await expect(pairExtension(roomSession, "attacker_extension_id", { runtime })).rejects.toThrow(
      "trusted configuration"
    );
    expect(runtime.sendMessage).not.toHaveBeenCalled();
  });
});

describe("getExtensionStatus", () => {
  it("parses wrong-title warnings from the extension", async () => {
    const runtime = {
      sendMessage: vi.fn(
        (_extensionId: string, _message: unknown, callback: (response: unknown) => void) => {
          callback({
            ok: true,
            pairedRoomId: "room_12345678",
            playbackState: playbackState("81234567", "Current title"),
            realtimeConnected: true,
            syncWarning: {
              type: "wrong-title",
              roomId: "room_12345678",
              participantId: "participant_guest",
              expectedWatchId: "89999999",
              expectedTitleHint: "Host title",
              expectedUrl: "https://www.netflix.com/watch/89999999",
              currentWatchId: "81234567",
              currentTitleHint: "Current title",
              detectedAt: 1_779_984_000_000
            }
          });
        }
      )
    };

    await expect(getExtensionStatus("extension_id", { runtime })).resolves.toMatchObject({
      ok: true,
      syncWarning: {
        type: "wrong-title",
        expectedWatchId: "89999999",
        currentWatchId: "81234567"
      }
    });
    expect(runtime.sendMessage).toHaveBeenCalledWith(
      "extension_id",
      { type: "GET_STATUS" },
      expect.any(Function)
    );
  });

  it("rejects malformed status responses", async () => {
    const runtime = {
      sendMessage: vi.fn(
        (_extensionId: string, _message: unknown, callback: (response: unknown) => void) => {
          callback({ ok: true, realtimeConnected: true });
        }
      )
    };

    await expect(getExtensionStatus("extension_id", { runtime })).rejects.toThrow(
      "Unexpected extension response"
    );
  });
});

const roomSession: RoomSession = {
  participant: {
    cameraEnabled: false,
    displayName: "Host",
    id: "participant_host",
    joinedAt: "2026-05-29T00:00:00.000Z",
    muted: false,
    role: "host"
  },
  room: {
    createdAt: "2026-05-29T00:00:00.000Z",
    expiresAt: "2026-05-30T00:00:00.000Z",
    id: "room_12345678",
    inviteCode: "invite_12345678",
    locked: false,
    participants: [],
    title: "Movie night"
  },
  sessionToken: "crs_123456789012345678901234"
};

function playbackState(watchId: string, titleHint: string) {
  return {
    watchId,
    titleHint,
    url: `https://www.netflix.com/watch/${watchId}`,
    paused: true,
    currentTime: 120,
    duration: 3600,
    playbackRate: 1,
    buffering: false,
    observedAt: 1_779_984_000_000,
    sequence: 1
  };
}
