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

  it("does not trust arbitrary externally connectable origins", () => {
    const findings = auditExtensionManifest({
      externally_connectable: {
        matches: ["<all_urls>", "https://evil.example/*"]
      }
    });

    expect(findings).toContainEqual({
      severity: "critical",
      message: "Extension must not trust arbitrary external web origins"
    });
    expect(findings).toContainEqual({
      severity: "high",
      message: "Unexpected externally_connectable match: https://evil.example/*"
    });
  });

  it("audits optional permissions and content script matches", () => {
    const findings = auditExtensionManifest({
      optional_permissions: ["tabs"],
      optional_host_permissions: ["https://example.com/*"],
      content_scripts: [
        {
          matches: ["<all_urls>", "https://example.com/*"],
          js: ["https://cdn.example.com/content-script.js"],
          world: "MAIN"
        }
      ]
    });

    expect(findings).toContainEqual({
      severity: "high",
      message: "Unexpected extension optional permission: tabs"
    });
    expect(findings).toContainEqual({
      severity: "high",
      message: "Unexpected optional host permission: https://example.com/*"
    });
    expect(findings).toContainEqual({
      severity: "critical",
      message: "Extension content scripts must not match broad hosts"
    });
    expect(findings).toContainEqual({
      severity: "high",
      message: "Unexpected content script match: https://example.com/*"
    });
    expect(findings).toContainEqual({
      severity: "critical",
      message: "Content script must be bundled locally: https://cdn.example.com/content-script.js"
    });
    expect(findings).toContainEqual({
      severity: "high",
      message: "Content scripts must run in the isolated world"
    });
  });
});
