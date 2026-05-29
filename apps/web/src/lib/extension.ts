import { extensionPairRequestSchema, type RoomSession } from "@cueroom/shared";
import { getApiOrigin } from "@/lib/api";

type ChromeRuntime = {
  lastError?: {
    message?: string;
  };
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: unknown) => void
  ) => void;
};

type WindowWithChrome = Window & {
  chrome?: {
    runtime?: ChromeRuntime;
  };
};

type PairExtensionResult = {
  ok: boolean;
  tabPaired?: boolean;
  realtime?: boolean;
  error?: string;
};

const extensionIdStorageKey = "cueroom.extensionId";

export function getStoredExtensionId() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_CUEROOM_EXTENSION_ID?.trim() ?? "";
  }
  return (
    process.env.NEXT_PUBLIC_CUEROOM_EXTENSION_ID?.trim() ||
    window.localStorage.getItem(extensionIdStorageKey)?.trim() ||
    ""
  );
}

export function rememberExtensionId(extensionId: string) {
  const trimmed = extensionId.trim();
  if (typeof window === "undefined" || !trimmed) {
    return;
  }
  window.localStorage.setItem(extensionIdStorageKey, trimmed);
}

export async function pairExtension(
  session: RoomSession,
  extensionId: string,
  options: { apiOrigin?: string; runtime?: ChromeRuntime } = {}
) {
  const runtime = options.runtime ?? (window as WindowWithChrome).chrome?.runtime;
  const trimmedExtensionId = extensionId.trim();
  if (!runtime || !trimmedExtensionId) {
    throw new Error("CueRoom extension is unavailable");
  }

  const request = extensionPairRequestSchema.parse({
    type: "PAIR_ROOM",
    roomId: session.room.id,
    participantId: session.participant.id,
    sessionToken: session.sessionToken,
    appOrigin: window.location.origin,
    apiOrigin: getApiOrigin(options.apiOrigin)
  });

  return new Promise<PairExtensionResult>((resolve, reject) => {
    runtime.sendMessage(trimmedExtensionId, request, (response) => {
      const error = runtime.lastError?.message;
      if (error) {
        reject(new Error(error));
        return;
      }
      if (!isPairExtensionResult(response)) {
        reject(new Error("Unexpected extension response"));
        return;
      }
      resolve(response);
    });
  });
}

function isPairExtensionResult(response: unknown): response is PairExtensionResult {
  if (!response || typeof response !== "object") {
    return false;
  }
  if (!("ok" in response) || typeof response.ok !== "boolean") {
    return false;
  }
  if ("error" in response && typeof response.error !== "string") {
    return false;
  }
  return true;
}
