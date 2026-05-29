import { describe, expect, it, vi } from "vitest";
import {
  createRoom,
  fetchLiveKitConnectionDetails,
  getAccount,
  getApiOrigin,
  requestMagicLink,
  verifyMagicLink
} from "./api";

const account = {
  id: "acct_12345678",
  email: "host@example.com",
  displayName: "Host",
  webauthnUserId: "webauthn_12345678",
  createdAt: "2099-05-29T12:00:00.000Z",
  lastLoginAt: "2099-05-29T12:00:00.000Z"
};

const roomSession = {
  room: {
    id: "room_12345678",
    inviteCode: "invite123",
    title: "Movie night",
    locked: false,
    createdAt: "2099-05-29T12:00:00.000Z",
    expiresAt: "2099-05-29T18:00:00.000Z",
    participants: [
      {
        id: "p_12345678",
        displayName: "Host",
        role: "host",
        joinedAt: "2099-05-29T12:00:00.000Z",
        muted: false,
        cameraEnabled: true
      }
    ]
  },
  participant: {
    id: "p_12345678",
    displayName: "Host",
    role: "host",
    joinedAt: "2099-05-29T12:00:00.000Z",
    muted: false,
    cameraEnabled: true
  },
  sessionToken: "crs_123456789012345678901234"
};

describe("getApiOrigin", () => {
  it("normalizes HTTP origins and drops paths", () => {
    expect(getApiOrigin("https://example.com/api")).toBe("https://example.com");
  });

  it("falls back when the configured origin is not HTTP(S)", () => {
    expect(getApiOrigin("ws://localhost:7880")).toBe("http://localhost:4000");
  });
});

describe("fetchLiveKitConnectionDetails", () => {
  it("posts the room session to the scoped token endpoint", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        url: "ws://localhost:7880",
        token: "jwt_token_with_enough_entropy"
      })
    );

    await expect(
      fetchLiveKitConnectionDetails(
        {
          roomId: "room_12345678",
          participantId: "p_12345678",
          sessionToken: "crs_123456789012345678901234"
        },
        { apiOrigin: "http://api.test", fetcher }
      )
    ).resolves.toEqual({
      url: "ws://localhost:7880",
      token: "jwt_token_with_enough_entropy"
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://api.test/v1/livekit/token",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json"
        }
      })
    );
  });

  it("rejects non-WebSocket LiveKit URLs", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        url: "https://localhost:7880",
        token: "jwt_token_with_enough_entropy"
      })
    );

    await expect(
      fetchLiveKitConnectionDetails(
        {
          roomId: "room_12345678",
          participantId: "p_12345678",
          sessionToken: "crs_123456789012345678901234"
        },
        { fetcher }
      )
    ).rejects.toThrow("Unexpected API response");
  });
});

describe("auth helpers", () => {
  it("requests a magic link and accepts development links when returned", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        accepted: true,
        expiresAt: "2099-05-29T12:15:00.000Z",
        devLink: "http://localhost:3000/auth/magic-link#token=cml_123456789012345678901234",
        devToken: "cml_123456789012345678901234"
      })
    );

    await expect(
      requestMagicLink(
        {
          email: " host@example.com ",
          displayName: " Host "
        },
        { apiOrigin: "http://api.test", fetcher }
      )
    ).resolves.toEqual({
      accepted: true,
      expiresAt: "2099-05-29T12:15:00.000Z",
      devLink: "http://localhost:3000/auth/magic-link#token=cml_123456789012345678901234",
      devToken: "cml_123456789012345678901234"
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://api.test/v1/auth/magic-link/request",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "host@example.com",
          displayName: "Host"
        })
      })
    );
  });

  it("verifies magic links with the token in the JSON body, not the URL", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        account,
        accountSessionToken: "cas_123456789012345678901234",
        expiresAt: "2099-06-29T12:00:00.000Z",
        authMethod: "magic_link"
      })
    );

    await expect(
      verifyMagicLink(" cml_123456789012345678901234 ", {
        apiOrigin: "http://api.test",
        fetcher
      })
    ).resolves.toEqual({
      account,
      accountSessionToken: "cas_123456789012345678901234",
      expiresAt: "2099-06-29T12:00:00.000Z",
      authMethod: "magic_link"
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://api.test/v1/auth/magic-link/verify",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "cml_123456789012345678901234"
        })
      })
    );
    expect(fetcher).not.toHaveBeenCalledWith(expect.stringContaining("cml_"), expect.anything());
  });

  it("loads the current account with a cas bearer token", async () => {
    const fetcher = vi.fn(async () => Response.json({ account }));

    await expect(
      getAccount("cas_123456789012345678901234", {
        apiOrigin: "http://api.test",
        fetcher
      })
    ).resolves.toEqual(account);

    expect(fetcher).toHaveBeenCalledWith("http://api.test/v1/auth/me", {
      method: "GET",
      headers: {
        authorization: "Bearer cas_123456789012345678901234"
      }
    });
  });

  it("adds account bearer auth to room creation when an account session is provided", async () => {
    const fetcher = vi.fn(async () => Response.json(roomSession));

    await expect(
      createRoom(
        {
          hostName: "Host",
          title: "Movie night"
        },
        {
          apiOrigin: "http://api.test",
          fetcher,
          accountSessionToken: "cas_123456789012345678901234"
        }
      )
    ).resolves.toEqual(roomSession);

    expect(fetcher).toHaveBeenCalledWith(
      "http://api.test/v1/rooms",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer cas_123456789012345678901234"
        }
      })
    );
  });
});
