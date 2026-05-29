import { describe, expect, it } from "vitest";
import { auditExtensionManifest, auditExtensionSource } from "./index";

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

describe("auditExtensionSource", () => {
  it("rejects remote code execution primitives", () => {
    const findings = auditExtensionSource([
      {
        path: "apps/extension/src/service-worker.ts",
        content: `
          eval("alert(1)");
          new Function("return location.href");
          import("https://cdn.example.com/remote.js");
        `
      }
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "critical",
          message: expect.stringContaining("Extension source must not call eval()")
        }),
        expect.objectContaining({
          severity: "critical",
          message: expect.stringContaining("Extension source must not construct functions")
        }),
        expect.objectContaining({
          severity: "critical",
          message: expect.stringContaining(
            "Extension source must not dynamically import remote code"
          )
        })
      ])
    );
  });

  it("rejects sensitive Netflix data and capture APIs", () => {
    const findings = auditExtensionSource([
      {
        path: "apps/extension/src/content-script.ts",
        content: `
          document.cookie;
          localStorage.getItem("netflix");
          video.textTracks[0];
          canvas.toDataURL();
          navigator.mediaDevices.getDisplayMedia();
          chrome.tabs.captureVisibleTab();
        `
      }
    ]);

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "critical",
          message: expect.stringContaining("cookies or browser storage")
        }),
        expect.objectContaining({
          severity: "high",
          message: expect.stringContaining("subtitle or media track data")
        }),
        expect.objectContaining({
          severity: "critical",
          message: expect.stringContaining("frames or screenshots")
        }),
        expect.objectContaining({
          severity: "critical",
          message: expect.stringContaining("video or audio")
        }),
        expect.objectContaining({
          severity: "critical",
          message: expect.stringContaining("capture tab screenshots")
        })
      ])
    );
  });

  it("allows CueRoom playback sync source patterns", () => {
    const findings = auditExtensionSource([
      {
        path: "apps/extension/src/content-script.ts",
        content: `
          const video = document.querySelector("video");
          const safeUrl = new URL("/watch/123", "https://www.netflix.com");
          void chrome.runtime.sendMessage({ type: "PLAYBACK_STATE", state: { url: safeUrl } });
        `
      },
      {
        path: "apps/extension/src/service-worker.ts",
        content: `
          const socket = new WebSocket("wss://api.cueroom.app/v1/rooms/demo/realtime");
          await chrome.storage.local.set({ pairedRoom: { roomId: "room_demo" } });
          await chrome.tabs.sendMessage(1, { type: "APPLY_SYNC_COMMAND", command: {} });
        `
      }
    ]);

    expect(findings).toEqual([]);
  });
});
