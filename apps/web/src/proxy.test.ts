import { describe, expect, it } from "vitest";
import { buildConnectSources, buildContentSecurityPolicy } from "./proxy";

describe("web CSP proxy helpers", () => {
  it("keeps localhost connect sources out of production CSP", () => {
    const sources = buildConnectSources(false);

    expect(sources).toContain("'self'");
    expect(sources.some((source) => source.includes("localhost"))).toBe(false);
  });

  it("keeps local dev connect sources available for local development", () => {
    expect(buildConnectSources(true)).toEqual(
      expect.arrayContaining(["http://localhost:4000", "ws://localhost:7880"])
    );
  });

  it("keeps nonce-based production CSP without unsafe-inline", () => {
    const policy = buildContentSecurityPolicy("nonce_for_test", false);

    expect(policy).toContain("script-src 'self' 'nonce-nonce_for_test' 'strict-dynamic'");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("localhost");
  });
});
