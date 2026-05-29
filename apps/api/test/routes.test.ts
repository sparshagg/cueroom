import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server";

describe("CueRoom API", () => {
  it("requires an account session for room creation when auth is required", async () => {
    const previousAuthRequired = process.env.AUTH_REQUIRED;
    process.env.AUTH_REQUIRED = "true";
    const server = await buildServer();
    try {
      const blocked = await server.inject({
        method: "POST",
        url: "/v1/rooms",
        payload: {
          hostName: "Host",
          title: "Private room"
        }
      });
      expect(blocked.statusCode).toBe(401);

      const requested = (
        await server.inject({
          method: "POST",
          url: "/v1/auth/magic-link/request",
          payload: {
            email: "host@example.com",
            displayName: "Host"
          }
        })
      ).json();
      expect(requested.devToken).toMatch(/^cml_/);

      const verified = (
        await server.inject({
          method: "POST",
          url: "/v1/auth/magic-link/verify",
          payload: {
            token: requested.devToken
          }
        })
      ).json();
      expect(verified.accountSessionToken).toMatch(/^cas_/);

      const created = await server.inject({
        method: "POST",
        url: "/v1/rooms",
        headers: {
          authorization: `Bearer ${verified.accountSessionToken}`
        },
        payload: {
          hostName: "Host",
          title: "Private room"
        }
      });
      expect(created.statusCode).toBe(200);
    } finally {
      await server.close();
      if (previousAuthRequired === undefined) {
        delete process.env.AUTH_REQUIRED;
      } else {
        process.env.AUTH_REQUIRED = previousAuthRequired;
      }
    }
  });

  it("does not confuse account sessions and room sessions", async () => {
    const server = await buildServer();
    const requested = (
      await server.inject({
        method: "POST",
        url: "/v1/auth/magic-link/request",
        payload: {
          email: "host@example.com",
          displayName: "Host"
        }
      })
    ).json();
    const verified = (
      await server.inject({
        method: "POST",
        url: "/v1/auth/magic-link/verify",
        payload: {
          token: requested.devToken
        }
      })
    ).json();
    const created = (
      await server.inject({
        method: "POST",
        url: "/v1/rooms",
        payload: {
          hostName: "Host",
          title: "Room"
        }
      })
    ).json();

    const roomTokenForAccountRoute = await server.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: {
        authorization: `Bearer ${created.sessionToken}`
      }
    });
    expect(roomTokenForAccountRoute.statusCode).toBe(401);

    const accountTokenForRoomRoute = await server.inject({
      method: "GET",
      url: `/v1/rooms/${created.room.id}`,
      headers: {
        authorization: `Bearer ${verified.accountSessionToken}`
      }
    });
    expect(accountTokenForRoomRoute.statusCode).toBe(403);

    const accountRoute = await server.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: {
        authorization: `Bearer ${verified.accountSessionToken}`
      }
    });
    expect(accountRoute.statusCode).toBe(200);
    await server.close();
  });

  it("creates passkey registration options for authenticated accounts only", async () => {
    const server = await buildServer();
    const unauthorized = await server.inject({
      method: "POST",
      url: "/v1/auth/passkeys/registration/options"
    });
    expect(unauthorized.statusCode).toBe(401);

    const requested = (
      await server.inject({
        method: "POST",
        url: "/v1/auth/magic-link/request",
        payload: {
          email: "host@example.com",
          displayName: "Host"
        }
      })
    ).json();
    const verified = (
      await server.inject({
        method: "POST",
        url: "/v1/auth/magic-link/verify",
        payload: {
          token: requested.devToken
        }
      })
    ).json();
    const options = await server.inject({
      method: "POST",
      url: "/v1/auth/passkeys/registration/options",
      headers: {
        authorization: `Bearer ${verified.accountSessionToken}`
      }
    });

    expect(options.statusCode).toBe(200);
    expect(options.json().challenge).toBeTruthy();
    expect(options.json().authenticatorSelection.userVerification).toBe("required");
    await server.close();
  });

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
