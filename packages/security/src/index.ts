export const forbiddenExtensionPermissions = new Set([
  "cookies",
  "webRequest",
  "webRequestBlocking",
  "debugger",
  "tabCapture",
  "desktopCapture"
]);

export type ExtensionManifestLike = {
  permissions?: string[];
  host_permissions?: string[];
  content_security_policy?: {
    extension_pages?: string;
  };
};

export type ManifestAuditFinding = {
  severity: "critical" | "high" | "medium";
  message: string;
};

export function auditExtensionManifest(manifest: ExtensionManifestLike): ManifestAuditFinding[] {
  const findings: ManifestAuditFinding[] = [];
  const permissions = manifest.permissions ?? [];
  const hostPermissions = manifest.host_permissions ?? [];

  for (const permission of permissions) {
    if (forbiddenExtensionPermissions.has(permission)) {
      findings.push({
        severity: "critical",
        message: `Forbidden extension permission: ${permission}`
      });
    }
  }

  if (
    hostPermissions.includes("<all_urls>") ||
    hostPermissions.some((entry) => entry === "*://*/*")
  ) {
    findings.push({
      severity: "critical",
      message: "Extension must not request broad host access"
    });
  }

  for (const host of hostPermissions) {
    if (!host.includes("netflix.com") && !host.includes("localhost") && !host.includes("cueroom")) {
      findings.push({
        severity: "high",
        message: `Unexpected host permission: ${host}`
      });
    }
  }

  const csp = manifest.content_security_policy?.extension_pages ?? "";
  if (/unsafe-eval|http:|https:/.test(csp)) {
    findings.push({
      severity: "critical",
      message: "Extension CSP must not allow remote code, HTTP, HTTPS scripts, or unsafe-eval"
    });
  }

  return findings;
}
