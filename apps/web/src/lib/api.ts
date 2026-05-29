import {
  createRoomRequestSchema,
  joinRoomRequestSchema,
  liveKitTokenRequestSchema,
  liveKitTokenResponseSchema,
  roomSessionSchema,
  type CreateRoomRequest,
  type JoinRoomRequest,
  type LiveKitTokenRequest,
  type LiveKitTokenResponse,
  type RoomSession
} from "@cueroom/shared";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

class CueRoomApiError extends Error {
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
  options: { fetcher?: Fetcher; apiOrigin?: string } = {}
): Promise<RoomSession> {
  const body = createRoomRequestSchema.parse(input);
  return postJson("/v1/rooms", body, roomSessionSchema.parse, options);
}

export async function joinRoom(
  input: JoinRoomRequest,
  options: { fetcher?: Fetcher; apiOrigin?: string } = {}
): Promise<RoomSession> {
  const body = joinRoomRequestSchema.parse(input);
  return postJson("/v1/rooms/join", body, roomSessionSchema.parse, options);
}

export async function fetchLiveKitConnectionDetails(
  input: LiveKitTokenRequest,
  options: { fetcher?: Fetcher; apiOrigin?: string } = {}
): Promise<LiveKitTokenResponse> {
  const body = liveKitTokenRequestSchema.parse(input);
  return postJson("/v1/livekit/token", body, liveKitTokenResponseSchema.parse, options);
}

async function postJson<T>(
  path: string,
  body: unknown,
  parse: (payload: unknown) => T,
  options: { fetcher?: Fetcher; apiOrigin?: string }
) {
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(`${getApiOrigin(options.apiOrigin)}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
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
