import { describe, expect, it, vi } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
import { buildServer } from "../src/server";

describe("CueRoom API", () => {
  it("sets baseline security headers on API responses", async () => {
    const server = await buildServer();
    try {
      const response = await server.inject({
        method: "GET",
        url: "/health"
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    } finally {
      await server.close();
    }
  });

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

      const requested = await requestDevMagicLink(server, {
        email: "host@example.com",
        displayName: "Host"
      });
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

  it("does not expose magic-link tokens when SMTP delivery fails", async () => {
    const sendMagicLink = vi.fn(async () => {
      throw new Error("smtp unavailable");
    });
    const server = await buildServer({
      mailer: {
        sendMagicLink
      }
    });
    try {
      const response = await server.inject({
        method: "POST",
        url: "/v1/auth/magic-link/request",
        payload: {
          email: "host@example.com",
          displayName: "Host"
        }
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toEqual({ error: "Magic link delivery unavailable" });
      expect(response.body).not.toContain("cml_");
      expect(sendMagicLink).toHaveBeenCalledOnce();
    } finally {
      await server.close();
    }
  });

  it("does not confuse account sessions and room sessions", async () => {
    const server = await buildServer();
    const requested = await requestDevMagicLink(server, {
      email: "host@example.com",
      displayName: "Host"
    });
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

    const requested = await requestDevMagicLink(server, {
      email: "host@example.com",
      displayName: "Host"
    });
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

  it("mints narrow LiveKit tokens only for the active room participant", async () => {
    const previousUrl = process.env.LIVEKIT_URL;
    const previousKey = process.env.LIVEKIT_API_KEY;
    const previousSecret = process.env.LIVEKIT_API_SECRET;
    process.env.LIVEKIT_URL = "ws://localhost:7880";
    process.env.LIVEKIT_API_KEY = "devkey";
    process.env.LIVEKIT_API_SECRET = "secret";

    const server = await buildServer({
      removeLiveKitParticipant: async () => undefined
    });
    try {
      const created = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms",
          payload: { hostName: "Host", title: "Room" }
        })
      ).json();

      const wrongParticipant = await server.inject({
        method: "POST",
        url: "/v1/livekit/token",
        payload: {
          roomId: created.room.id,
          participantId: "p_attacker",
          sessionToken: created.sessionToken
        }
      });
      expect(wrongParticipant.statusCode).toBe(403);

      const accountToken = await server.inject({
        method: "POST",
        url: "/v1/livekit/token",
        payload: {
          roomId: created.room.id,
          participantId: created.participant.id,
          sessionToken: "cas_123456789012345678901234"
        }
      });
      expect(accountToken.statusCode).toBe(400);

      const tokenResponse = await server.inject({
        method: "POST",
        url: "/v1/livekit/token",
        payload: {
          roomId: created.room.id,
          participantId: created.participant.id,
          sessionToken: created.sessionToken
        }
      });
      expect(tokenResponse.statusCode).toBe(200);
      expect(tokenResponse.json().url).toBe("ws://localhost:7880");

      const claims = await new TokenVerifier("devkey", "secret").verify(tokenResponse.json().token);
      expect(claims.sub).toBe(created.participant.id);
      expect(claims.video).toMatchObject({
        room: created.room.id,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        canPublishSources: ["camera", "microphone"]
      });
      expect(claims.video?.roomAdmin).toBeUndefined();
      expect(claims.video?.roomCreate).toBeUndefined();
      expect(claims.video?.roomList).toBeUndefined();
      expect(claims.video?.roomRecord).toBeUndefined();

      const guest = (
        await server.inject({
          method: "POST",
          url: "/v1/rooms/join",
          payload: {
            inviteCode: created.room.inviteCode,
            displayName: "Guest"
          }
        })
      ).json();
      const kicked = await server.inject({
        method: "POST",
        url: `/v1/rooms/${created.room.id}/kick`,
        payload: {
          sessionToken: created.sessionToken,
          participantId: guest.participant.id
        }
      });
      expect(kicked.statusCode).toBe(200);

      const kickedToken = await server.inject({
        method: "POST",
        url: "/v1/livekit/token",
        payload: {
          roomId: created.room.id,
          participantId: guest.participant.id,
          sessionToken: guest.sessionToken
        }
      });
      expect(kickedToken.statusCode).toBe(403);
    } finally {
      await server.close();
      restoreEnv("LIVEKIT_URL", previousUrl);
      restoreEnv("LIVEKIT_API_KEY", previousKey);
      restoreEnv("LIVEKIT_API_SECRET", previousSecret);
    }
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

  it("accepts authenticated room participant reports without returning report details", async () => {
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

    const report = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/report`,
      payload: {
        sessionToken: created.sessionToken,
        targetParticipantId: guest.participant.id,
        reason: "spam",
        details: "Repeated invite spam"
      }
    });

    expect(report.statusCode).toBe(200);
    expect(report.json().report).toMatchObject({
      roomId: created.room.id,
      reporterParticipantId: created.participant.id,
      targetParticipantId: guest.participant.id,
      reason: "spam"
    });
    expect(report.body).not.toContain("Repeated invite spam");
    await server.close();
  });

  it("rejects unauthenticated, self, and unknown participant reports", async () => {
    const server = await buildServer();
    const created = (
      await server.inject({
        method: "POST",
        url: "/v1/rooms",
        payload: { hostName: "Host", title: "Room" }
      })
    ).json();

    const unauthenticated = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/report`,
      payload: {
        sessionToken: "crs_wrongwrongwrongwrongwrong",
        targetParticipantId: created.participant.id,
        reason: "spam"
      }
    });
    expect(unauthenticated.statusCode).toBe(403);

    const self = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/report`,
      payload: {
        sessionToken: created.sessionToken,
        targetParticipantId: created.participant.id,
        reason: "spam"
      }
    });
    expect(self.statusCode).toBe(403);

    const unknown = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/report`,
      payload: {
        sessionToken: created.sessionToken,
        targetParticipantId: "p_missing123",
        reason: "spam"
      }
    });
    expect(unknown.statusCode).toBe(403);

    const oversized = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/report`,
      payload: {
        sessionToken: created.sessionToken,
        targetParticipantId: "p_missing123",
        reason: "spam",
        details: "x".repeat(501)
      }
    });
    expect(oversized.statusCode).toBe(400);
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

  it("reports kick failure when LiveKit call removal fails", async () => {
    const server = await buildServer({
      removeLiveKitParticipant: async () => {
        throw new Error("LiveKit unavailable");
      }
    });
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

    const kicked = await server.inject({
      method: "POST",
      url: `/v1/rooms/${created.room.id}/kick`,
      payload: {
        sessionToken: created.sessionToken,
        participantId: guest.participant.id
      }
    });

    expect(kicked.statusCode).toBe(502);
    expect(kicked.json()).toEqual({
      error: "Participant removed from room, but call removal failed"
    });
    await server.close();
  });
});

async function requestDevMagicLink(
  server: Awaited<ReturnType<typeof buildServer>>,
  payload: { email: string; displayName?: string }
) {
  const previousDevMagicLinks = process.env.AUTH_DEV_MAGIC_LINKS;
  process.env.AUTH_DEV_MAGIC_LINKS = "true";
  try {
    return (
      await server.inject({
        method: "POST",
        url: "/v1/auth/magic-link/request",
        payload
      })
    ).json();
  } finally {
    restoreEnv("AUTH_DEV_MAGIC_LINKS", previousDevMagicLinks);
  }
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
