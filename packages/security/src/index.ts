export const forbiddenExtensionPermissions = new Set([
  "cookies",
  "webRequest",
  "webRequestBlocking",
  "debugger",
  "tabCapture",
  "desktopCapture"
]);

export const allowedExtensionHostPermissions = new Set(["https://www.netflix.com/watch/*"]);
export const allowedExternallyConnectableMatches = new Set([
  "http://localhost:3000/*",
  "https://cueroom.app/*"
]);

export type ExtensionManifestLike = {
  permissions?: string[];
  host_permissions?: string[];
  externally_connectable?: {
    matches?: string[];
  };
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
    if (!allowedExtensionHostPermissions.has(host)) {
      findings.push({
        severity: "high",
        message: `Unexpected host permission: ${host}`
      });
    }
  }

  const externalMatches = manifest.externally_connectable?.matches ?? [];
  if (
    externalMatches.includes("<all_urls>") ||
    externalMatches.some((entry) => entry === "*://*/*")
  ) {
    findings.push({
      severity: "critical",
      message: "Extension must not trust arbitrary external web origins"
    });
  }

  for (const match of externalMatches) {
    if (!allowedExternallyConnectableMatches.has(match)) {
      findings.push({
        severity: "high",
        message: `Unexpected externally_connectable match: ${match}`
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
