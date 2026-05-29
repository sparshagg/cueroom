import { describe, expect, it, vi } from "vitest";
import { fetchLiveKitConnectionDetails, getApiOrigin } from "./api";

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
