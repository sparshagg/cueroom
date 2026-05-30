import { describe, expect, it } from "vitest";
import { validateLiveKitConfig } from "../src/livekit";

describe("validateLiveKitConfig", () => {
  it("requires wss LiveKit URLs in production", () => {
    expect(() =>
      validateLiveKitConfig({
        NODE_ENV: "production",
        LIVEKIT_URL: "ws://livekit.example.test",
        LIVEKIT_API_KEY: "cueroom-prod",
        LIVEKIT_API_SECRET: "real-livekit-secret"
      })
    ).toThrow(/wss/);
  });

  it("rejects development LiveKit credentials in production", () => {
    expect(() =>
      validateLiveKitConfig({
        NODE_ENV: "production",
        LIVEKIT_URL: "wss://livekit.example.test",
        LIVEKIT_API_KEY: "devkey",
        LIVEKIT_API_SECRET: "secret"
      })
    ).toThrow(/development placeholder/);
  });

  it("accepts the production LiveKit boundary", () => {
    expect(() =>
      validateLiveKitConfig({
        NODE_ENV: "production",
        LIVEKIT_URL: "wss://livekit.example.test",
        LIVEKIT_API_KEY: "cueroom-prod",
        LIVEKIT_API_SECRET: "real-livekit-secret"
      })
    ).not.toThrow();
  });
});
