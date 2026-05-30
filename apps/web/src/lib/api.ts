import {
  createRoomRequestSchema,
  joinRoomRequestSchema,
  liveKitTokenRequestSchema,
  liveKitTokenResponseSchema,
  roomReportRequestSchema,
  roomReportResponseSchema,
  roomSessionSchema,
  type CreateRoomRequest,
  type JoinRoomRequest,
  type LiveKitTokenRequest,
  type LiveKitTokenResponse,
  type RoomReportRequest,
  type RoomReportResponse,
  type RoomSession
} from "@cueroom/shared";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ApiOptions = {
  fetcher?: Fetcher;
  apiOrigin?: string;
  accountSessionToken?: string;
};

export type Account = {
  id: string;
  email: string;
  displayName: string;
  webauthnUserId: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type AuthMethod = "magic_link" | "passkey";

type MagicLinkRequest = {
  email: string;
  displayName?: string;
};

export type MagicLinkRequestResult = {
  accepted: true;
  expiresAt: string;
  devToken?: string;
  devLink?: string;
};

export type AccountSession = {
  account: Account;
  accountSessionToken: string;
  expiresAt: string;
  authMethod: AuthMethod;
};

export class CueRoomApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "CueRoomApiError";
  }
}

export function getApiOrigin(origin = process.env.NEXT_PUBLIC_API_ORIGIN) {
  const configuredOrigin = origin?.trim() || "http://localhost:4000";

  try {
    const url = new URL(configuredOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "http://localhost:4000";
    }
    return url.origin;
  } catch {
    return "http://localhost:4000";
  }
}

export async function createRoom(
  input: CreateRoomRequest,
  options: ApiOptions = {}
): Promise<RoomSession> {
  const body = createRoomRequestSchema.parse(input);
  return postJson("/v1/rooms", body, roomSessionSchema.parse, options);
}

export async function joinRoom(
  input: JoinRoomRequest,
  options: ApiOptions = {}
): Promise<RoomSession> {
  const body = joinRoomRequestSchema.parse(input);
  return postJson("/v1/rooms/join", body, roomSessionSchema.parse, options);
}

export async function fetchLiveKitConnectionDetails(
  input: LiveKitTokenRequest,
  options: ApiOptions = {}
): Promise<LiveKitTokenResponse> {
  const body = liveKitTokenRequestSchema.parse(input);
  return postJson("/v1/livekit/token", body, liveKitTokenResponseSchema.parse, options);
}

export async function reportRoomParticipant(
  roomId: string,
  input: RoomReportRequest,
  options: ApiOptions = {}
): Promise<RoomReportResponse> {
  const body = roomReportRequestSchema.parse(input);
  return postJson(
    `/v1/rooms/${encodeURIComponent(roomId)}/report`,
    body,
    roomReportResponseSchema.parse,
    options
  );
}

export async function requestMagicLink(
  input: MagicLinkRequest,
  options: ApiOptions = {}
): Promise<MagicLinkRequestResult> {
  const email = input.email.trim();
  const displayName = input.displayName?.trim();
  const body = {
    email,
    ...(displayName ? { displayName } : {})
  };

  return postJson("/v1/auth/magic-link/request", body, parseMagicLinkRequestResult, options);
}

export async function verifyMagicLink(
  token: string,
  options: ApiOptions = {}
): Promise<AccountSession> {
  return postJson(
    "/v1/auth/magic-link/verify",
    { token: token.trim() },
    parseAccountSession,
    options
  );
}

export async function getAccount(
  accountSessionToken: string,
  options: Omit<ApiOptions, "accountSessionToken"> = {}
): Promise<Account> {
  return getJson("/v1/auth/me", parseAccountEnvelope, {
    ...options,
    accountSessionToken: accountSessionToken.trim()
  });
}

async function postJson<T>(
  path: string,
  body: unknown,
  parse: (payload: unknown) => T,
  options: ApiOptions
) {
  const fetcher = options.fetcher ?? fetch;
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  setAccountAuthorizationHeader(headers, options.accountSessionToken);

  const response = await fetcher(`${getApiOrigin(options.apiOrigin)}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new CueRoomApiError(extractErrorMessage(payload), response.status);
  }

  try {
    return parse(payload);
  } catch {
    throw new CueRoomApiError("Unexpected API response", response.status);
  }
}

async function getJson<T>(path: string, parse: (payload: unknown) => T, options: ApiOptions) {
  const fetcher = options.fetcher ?? fetch;
  const headers: Record<string, string> = {};
  setAccountAuthorizationHeader(headers, options.accountSessionToken);

  const response = await fetcher(`${getApiOrigin(options.apiOrigin)}${path}`, {
    method: "GET",
    headers
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new CueRoomApiError(extractErrorMessage(payload), response.status);
  }

  try {
    return parse(payload);
  } catch {
    throw new CueRoomApiError("Unexpected API response", response.status);
  }
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

function extractErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string" &&
    payload.error.length <= 160
  ) {
    return payload.error;
  }
  return "CueRoom API request failed";
}

function setAccountAuthorizationHeader(
  headers: Record<string, string>,
  accountSessionToken?: string
) {
  const token = accountSessionToken?.trim();
  if (!token || !token.startsWith("cas_") || token.length < 24) {
    return;
  }
  headers.authorization = `Bearer ${token}`;
}

function parseMagicLinkRequestResult(payload: unknown): MagicLinkRequestResult {
  if (!isRecord(payload) || payload.accepted !== true || !isIsoDateString(payload.expiresAt)) {
    throw new Error("Invalid magic-link response");
  }

  const result: MagicLinkRequestResult = {
    accepted: true,
    expiresAt: payload.expiresAt
  };

  if (typeof payload.devToken === "string" && isMagicLinkToken(payload.devToken)) {
    result.devToken = payload.devToken;
  }
  if (typeof payload.devLink === "string" && isHttpUrl(payload.devLink)) {
    result.devLink = payload.devLink;
  }

  return result;
}

function parseAccountEnvelope(payload: unknown): Account {
  if (!isRecord(payload)) {
    throw new Error("Invalid account response");
  }
  return parseAccount(payload.account);
}

function parseAccountSession(payload: unknown): AccountSession {
  if (
    !isRecord(payload) ||
    !isAccountSessionToken(payload.accountSessionToken) ||
    !isIsoDateString(payload.expiresAt) ||
    !isAuthMethod(payload.authMethod)
  ) {
    throw new Error("Invalid account session response");
  }

  return {
    account: parseAccount(payload.account),
    accountSessionToken: payload.accountSessionToken,
    expiresAt: payload.expiresAt,
    authMethod: payload.authMethod
  };
}

function parseAccount(payload: unknown): Account {
  if (
    !isRecord(payload) ||
    typeof payload.id !== "string" ||
    payload.id.length < 8 ||
    typeof payload.email !== "string" ||
    payload.email.length < 3 ||
    typeof payload.displayName !== "string" ||
    payload.displayName.length < 1 ||
    typeof payload.webauthnUserId !== "string" ||
    payload.webauthnUserId.length < 8 ||
    !isIsoDateString(payload.createdAt) ||
    !(payload.lastLoginAt === null || isIsoDateString(payload.lastLoginAt))
  ) {
    throw new Error("Invalid account");
  }

  return {
    id: payload.id,
    email: payload.email,
    displayName: payload.displayName,
    webauthnUserId: payload.webauthnUserId,
    createdAt: payload.createdAt,
    lastLoginAt: payload.lastLoginAt
  };
}

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload));
}

function isAuthMethod(value: unknown): value is AuthMethod {
  return value === "magic_link" || value === "passkey";
}

function isAccountSessionToken(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("cas_") && value.length >= 24;
}

function isMagicLinkToken(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("cml_") && value.length >= 24;
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
