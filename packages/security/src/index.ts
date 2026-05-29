export const forbiddenExtensionPermissions = new Set([
  "cookies",
  "webRequest",
  "webRequestBlocking",
  "debugger",
  "tabCapture",
  "desktopCapture"
]);

export const allowedExtensionPermissions = new Set(["storage"]);
export const allowedExtensionHostPermissions = new Set(["https://www.netflix.com/watch/*"]);
export const allowedExternallyConnectableMatches = new Set([
  "http://localhost:3000/*",
  "https://cueroom.app/*"
]);

export type ExtensionManifestLike = {
  permissions?: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
  optional_host_permissions?: string[];
  content_scripts?: Array<{
    matches?: string[];
    js?: string[];
    world?: "ISOLATED" | "MAIN" | string;
  }>;
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
  const optionalPermissions = manifest.optional_permissions ?? [];
  const hostPermissions = manifest.host_permissions ?? [];
  const optionalHostPermissions = manifest.optional_host_permissions ?? [];
  const contentScripts = manifest.content_scripts ?? [];

  auditPermissions(findings, permissions, "permission");
  auditPermissions(findings, optionalPermissions, "optional permission");
  auditHostPermissions(findings, hostPermissions, "host permission");
  auditHostPermissions(findings, optionalHostPermissions, "optional host permission");
  auditContentScripts(findings, contentScripts);

  const externalMatches = manifest.externally_connectable?.matches ?? [];
  if (hasBroadMatch(externalMatches)) {
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

function auditPermissions(
  findings: ManifestAuditFinding[],
  permissions: string[],
  label: "permission" | "optional permission"
) {
  for (const permission of permissions) {
    if (forbiddenExtensionPermissions.has(permission)) {
      findings.push({
        severity: "critical",
        message: `Forbidden extension ${label}: ${permission}`
      });
      continue;
    }
    if (!allowedExtensionPermissions.has(permission)) {
      findings.push({
        severity: "high",
        message: `Unexpected extension ${label}: ${permission}`
      });
    }
  }
}

function auditHostPermissions(
  findings: ManifestAuditFinding[],
  hostPermissions: string[],
  label: "host permission" | "optional host permission"
) {
  if (hasBroadMatch(hostPermissions)) {
    findings.push({
      severity: "critical",
      message: `Extension must not request broad ${label}s`
    });
  }

  for (const host of hostPermissions) {
    if (!allowedExtensionHostPermissions.has(host)) {
      findings.push({
        severity: "high",
        message: `Unexpected ${label}: ${host}`
      });
    }
  }
}

function auditContentScripts(
  findings: ManifestAuditFinding[],
  contentScripts: NonNullable<ExtensionManifestLike["content_scripts"]>
) {
  for (const script of contentScripts) {
    for (const match of script.matches ?? []) {
      if (hasBroadMatch([match])) {
        findings.push({
          severity: "critical",
          message: "Extension content scripts must not match broad hosts"
        });
      }
      if (!allowedExtensionHostPermissions.has(match)) {
        findings.push({
          severity: "high",
          message: `Unexpected content script match: ${match}`
        });
      }
    }

    for (const scriptPath of script.js ?? []) {
      if (/^https?:\/\//.test(scriptPath)) {
        findings.push({
          severity: "critical",
          message: `Content script must be bundled locally: ${scriptPath}`
        });
      }
    }

    if (script.world === "MAIN") {
      findings.push({
        severity: "high",
        message: "Content scripts must run in the isolated world"
      });
    }
  }
}

function hasBroadMatch(matches: string[]) {
  return matches.includes("<all_urls>") || matches.some((entry) => entry === "*://*/*");
}
