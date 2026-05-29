import { describe, expect, it } from "vitest";
import { auditExtensionManifest } from "./index";

describe("auditExtensionManifest", () => {
  it("rejects broad and sensitive extension permissions", () => {
    const findings = auditExtensionManifest({
      permissions: ["storage", "cookies"],
      host_permissions: ["<all_urls>"],
      content_security_policy: {
        extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self'"
      }
    });

    expect(findings.map((finding) => finding.severity)).toContain("critical");
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });

  it("does not accept lookalike Netflix host permissions", () => {
    const findings = auditExtensionManifest({
      host_permissions: ["https://evil-netflix.com/watch/*"]
    });

    expect(findings).toContainEqual({
      severity: "high",
      message: "Unexpected host permission: https://evil-netflix.com/watch/*"
    });
  });
});
