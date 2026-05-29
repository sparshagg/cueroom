import { describe, expect, it } from "vitest";
import { createCspNonce, hasSensitiveDigitRun } from "./csp";

describe("createCspNonce", () => {
  it("creates base64url nonces without scanner-sensitive digit runs", () => {
    for (let index = 0; index < 512; index += 1) {
      const nonce = createCspNonce();

      expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(nonce.length).toBeGreaterThanOrEqual(24);
      expect(hasSensitiveDigitRun(nonce)).toBe(false);
    }
  });
});
