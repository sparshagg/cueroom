import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server";

describe("CueRoom API", () => {
  it("creates and joins an invite-only room", async () => {
    const server = await buildServer();

    const createResponse = await server.inject({
      method: "POST",
      url: "/v1/rooms",
      payload: {
        hostName: "Host",
        title: "Friday watch room"
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const created = createResponse.json();
    expect(created.room.inviteCode).toBeTruthy();

    const joinResponse = await server.inject({
      method: "POST",
      url: "/v1/rooms/join",
      payload: {
        inviteCode: created.room.inviteCode,
        displayName: "Guest"
      }
    });

    expect(joinResponse.statusCode).toBe(200);
    expect(joinResponse.json().participant.role).toBe("guest");

    await server.close();
  });

  it("blocks guest sync commands", async () => {
    const server = await buildServer();
    const created = (
      await server.inject({
        method: "POST",
        url: "/v1/rooms",
        payload: { hostName: "Host", title: "Room" }
      })
    ).json();
    const guest = (
      await server.inject({
        method: "POST",
        url: "/v1/rooms/join",
        payload: { inviteCode: created.room.inviteCode, displayName: "Guest" }
      })
    ).json();

    const response = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/sync-command`,
      payload: {
        sessionToken: guest.sessionToken,
        command: {
          roomId: created.room.id,
          actorId: guest.participant.id,
          command: "pause",
          issuedAt: Date.now(),
          sequence: 1
        }
      }
    });

    expect(response.statusCode).toBe(403);
    await server.close();
  });

  it("does not leak invite codes from the room metadata route", async () => {
    const server = await buildServer();
    const created = (
      await server.inject({
        method: "POST",
        url: "/v1/rooms",
        payload: { hostName: "Host", title: "Room" }
      })
    ).json();

    const unauthorized = await server.inject({
      method: "GET",
      url: `/v1/rooms/${created.room.id}`
    });
    expect(unauthorized.statusCode).toBe(403);

    const authorized = await server.inject({
      method: "GET",
      url: `/v1/rooms/${created.room.id}`,
      headers: {
        authorization: `Bearer ${created.sessionToken}`
      }
    });

    expect(authorized.statusCode).toBe(200);
    expect(authorized.json().room.inviteCode).toBeUndefined();
    await server.close();
  });

  it("rejects spoofed or replayed sync commands", async () => {
    const server = await buildServer();
    const created = (
      await server.inject({
        method: "POST",
        url: "/v1/rooms",
        payload: { hostName: "Host", title: "Room" }
      })
    ).json();

    const command = {
      roomId: created.room.id,
      actorId: created.participant.id,
      command: "pause",
      issuedAt: Date.now(),
      sequence: 1
    };

    const accepted = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/sync-command`,
      payload: {
        sessionToken: created.sessionToken,
        command
      }
    });
    expect(accepted.statusCode).toBe(200);

    const replay = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/sync-command`,
      payload: {
        sessionToken: created.sessionToken,
        command
      }
    });
    expect(replay.statusCode).toBe(403);

    const spoof = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/sync-command`,
      payload: {
        sessionToken: created.sessionToken,
        command: {
          ...command,
          actorId: "p_attacker",
          sequence: 2
        }
      }
    });
    expect(spoof.statusCode).toBe(403);
    await server.close();
  });
});
