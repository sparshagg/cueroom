import type { RoomSession } from "@cueroom/shared";
import { describe, expect, it, vi } from "vitest";
import { pairExtension } from "./extension";

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
