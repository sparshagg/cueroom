import manifest from "../src/manifest.json";
import { describe, expect, it } from "vitest";
import { auditExtensionManifest } from "@cueroom/security";

describe("extension manifest", () => {
  it("keeps permissions narrow", () => {
    expect(auditExtensionManifest(manifest)).toEqual([]);
  });

  it("does not request Netflix-sensitive permissions", () => {
    expect(manifest.permissions).not.toContain("cookies");
    expect(manifest.permissions).not.toContain("webRequest");
    expect(manifest.host_permissions).toEqual(["https://www.netflix.com/watch/*"]);
  });

  it("does not trust arbitrary web origins", () => {
    expect(JSON.stringify(manifest.externally_connectable)).not.toContain("<all_urls>");
    expect(manifest.externally_connectable.matches).toEqual([
      "http://localhost:3000/*",
      "https://cueroom.app/*"
    ]);
  });
});
