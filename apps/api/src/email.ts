import nodemailer, { type Transporter } from "nodemailer";
import { isIP } from "node:net";
import type { MagicLinkDeliveryInput } from "./auth-store.js";

export type MagicLinkMailer = {
  sendMagicLink(input: MagicLinkDeliveryInput): Promise<void>;
  close?(): Promise<void> | void;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  from: string;
  user?: string;
  password?: string;
};

export function createConfiguredMailer(): MagicLinkMailer | undefined {
  const config = readSmtpConfig();
  if (!config) {
    return undefined;
  }
  return createSmtpMagicLinkMailer(config);
}

export function validateEmailConfig() {
  const config = readSmtpConfig();
  const isProduction = process.env.NODE_ENV === "production";

  if (!config) {
    if (isProduction) {
      throw new Error("SMTP_HOST and SMTP_FROM are required in production");
    }
    return;
  }

  if (isProduction && !config.secure && !config.requireTLS) {
    throw new Error("SMTP must use implicit TLS or require STARTTLS in production");
  }

  if (isProduction && isIP(config.host) !== 0) {
    throw new Error("SMTP_HOST must be a hostname, not an IP literal, in production");
  }
}

function createSmtpMagicLinkMailer(config: SmtpConfig): MagicLinkMailer {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    ...(config.user || config.password
      ? {
          auth: {
            user: config.user ?? "",
            pass: config.password ?? ""
          }
        }
      : {})
  });

  return {
    async sendMagicLink(input) {
      const expiresAt = new Date(input.expiresAt);
      await transporter.sendMail({
        from: config.from,
        to: input.email,
        subject: "Sign in to CueRoom",
        text: [
          `Use this link to sign in to CueRoom: ${input.magicLinkUrl}`,
          "",
          `This link expires at ${expiresAt.toISOString()}.`,
          "If you did not request this, you can ignore this email."
        ].join("\n"),
        html: renderMagicLinkHtml(input, expiresAt),
        disableFileAccess: true,
        disableUrlAccess: true
      });
    },
    close() {
      closeTransporter(transporter);
    }
  };
}

function readSmtpConfig(): SmtpConfig | undefined {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const hasPartialConfig = Boolean(
    host ||
    from ||
    process.env.SMTP_PORT ||
    process.env.SMTP_USER ||
    process.env.SMTP_PASSWORD ||
    process.env.SMTP_SECURE ||
    process.env.SMTP_REQUIRE_TLS
  );

  if (!hasPartialConfig) {
    return undefined;
  }
  if (!host || !from) {
    throw new Error("SMTP_HOST and SMTP_FROM must be configured together");
  }

  const port = readPort(process.env.SMTP_PORT, 587);
  const secure = readBoolean(process.env.SMTP_SECURE, port === 465);
  const requireTLS = readBoolean(
    process.env.SMTP_REQUIRE_TLS,
    process.env.NODE_ENV === "production" && !secure
  );
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(password)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must be configured together");
  }

  return {
    host,
    port,
    secure,
    requireTLS,
    from,
    ...(user ? { user } : {}),
    ...(password ? { password } : {})
  };
}

function readPort(raw: string | undefined, fallback: number) {
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port");
  }
  return parsed;
}

function readBoolean(raw: string | undefined, fallback: boolean) {
  if (raw === undefined) {
    return fallback;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  throw new Error("Boolean SMTP settings must be true or false");
}

function renderMagicLinkHtml(input: MagicLinkDeliveryInput, expiresAt: Date) {
  const displayName = input.displayName ? `${escapeHtml(input.displayName)}, ` : "";
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<body>",
    `<p>${displayName}use this link to sign in to CueRoom:</p>`,
    `<p><a href="${escapeHtml(input.magicLinkUrl)}">Sign in to CueRoom</a></p>`,
    `<p>This link expires at ${escapeHtml(expiresAt.toISOString())}.</p>`,
    "<p>If you did not request this, you can ignore this email.</p>",
    "</body>",
    "</html>"
  ].join("");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function closeTransporter(transporter: Transporter) {
  if ("close" in transporter && typeof transporter.close === "function") {
    transporter.close();
  }
}
