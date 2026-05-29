"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Input, Panel } from "@cueroom/ui";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Copy,
  ExternalLink,
  Lock,
  LogIn,
  MessageCircle,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Send,
  ShieldCheck,
  SkipForward,
  Users
} from "lucide-react";
import { toast } from "sonner";
import type { RoomSession, SyncWarning } from "@cueroom/shared";
import { LiveCallPanel } from "@/components/LiveCallPanel";
import {
  getExtensionStatus,
  getStoredExtensionId,
  pairExtension,
  rememberExtensionId
} from "@/lib/extension";
import { clearRoomSession, readRoomSession } from "@/lib/room-session";
import { useLiveKitCall } from "./useLiveKitCall";

type ChatMessage = {
  id: string;
  sender: string;
  body: string;
  system?: boolean;
};

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    sender: "CueRoom",
    body: "Room created. Invite links expire automatically.",
    system: true
  },
  { id: "2", sender: "Mira", body: "Ready when everyone is synced." },
  { id: "3", sender: "Dev", body: "Camera off, still here." }
];

export function RoomExperience({ roomId }: { roomId: string }) {
  const [roomSession, setRoomSession] = useState<RoomSession | null>(null);
  const call = useLiveKitCall(roomSession);
  const [previewCameraEnabled, setPreviewCameraEnabled] = useState(false);
  const [previewMicEnabled, setPreviewMicEnabled] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [extensionBusy, setExtensionBusy] = useState(false);
  const [extensionId, setExtensionId] = useState("");
  const [extensionPaired, setExtensionPaired] = useState(false);
  const [syncWarning, setSyncWarning] = useState<SyncWarning | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const inviteUrl = useMemo(() => {
    const inviteCode = roomSession?.room.inviteCode ?? roomId;
    const origin = typeof window === "undefined" ? "https://cueroom.app" : window.location.origin;
    return `${origin}/join/${inviteCode}`;
  }, [roomId, roomSession?.room.inviteCode]);
  const displayTitle = roomSession?.room.title ?? "Friday watch room";
  const participantCount = roomSession?.room.participants.length ?? (call.participants.length || 3);
  const cameraEnabled = roomSession ? call.localCameraEnabled : previewCameraEnabled;
  const micEnabled = roomSession ? call.localMicrophoneEnabled : previewMicEnabled;

  useEffect(() => {
    setRoomSession(readRoomSession(roomId));
    setExtensionId(getStoredExtensionId());
  }, [roomId]);

  useEffect(() => {
    if (!extensionId.trim()) {
      return undefined;
    }

    let cancelled = false;
    async function refreshExtensionStatus() {
      try {
        const status = await getExtensionStatus(extensionId);
        if (cancelled || !status.ok) {
          return;
        }
        setExtensionPaired(Boolean(status.pairedRoomId && status.realtimeConnected));
        setSyncWarning(status.syncWarning);
      } catch {
        if (!cancelled) {
          setExtensionPaired(false);
        }
      }
    }

    void refreshExtensionStatus();
    const interval = window.setInterval(() => void refreshExtensionStatus(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [extensionId]);

  function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        sender: "You",
        body: trimmed
      }
    ]);
    setMessage("");
  }

  async function toggleCamera() {
    if (!roomSession || !call.canControlMedia) {
      setPreviewCameraEnabled((enabled) => !enabled);
      return;
    }

    try {
      await call.setCameraEnabled(!call.localCameraEnabled);
    } catch {
      toast.error("Could not update camera");
    }
  }

  async function toggleMic() {
    if (!roomSession || !call.canControlMedia) {
      setPreviewMicEnabled((enabled) => !enabled);
      return;
    }

    try {
      await call.setMicrophoneEnabled(!call.localMicrophoneEnabled);
    } catch {
      toast.error("Could not update microphone");
    }
  }

  async function leaveRoom() {
    await call.disconnect();
    clearRoomSession(roomId);
    setRoomSession(null);
    toast.message("Left room");
  }

  async function connectExtension() {
    if (!roomSession) {
      toast.message("Create or join a room before pairing the extension");
      return;
    }
    if (!extensionId.trim()) {
      toast.error("Extension ID is required");
      return;
    }
    setExtensionBusy(true);
    try {
      rememberExtensionId(extensionId);
      const response = await pairExtension(roomSession, extensionId);
      if (!response.ok) {
        toast.error(response.error ?? "Extension pairing failed");
        return;
      }
      setExtensionPaired(true);
      setSyncWarning(null);
      toast.success(
        response.tabPaired ? "Extension paired" : "Extension paired; open Netflix next"
      );
    } catch {
      toast.error("Could not pair extension");
    } finally {
      setExtensionBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-4 text-white md:px-6">
      <div className="mx-auto grid max-w-[1500px] gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-sm text-white/50">Room</p>
            <h1 className="text-xl font-semibold">{displayTitle}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">
              <ShieldCheck className="size-3.5" />
              Invite-only
            </Badge>
            <Badge tone={roomSession ? "sync" : "warning"}>
              {roomSession ? "Room session active" : "Demo mode"}
            </Badge>
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(inviteUrl);
                toast.success("Invite copied");
              }}
            >
              <Copy className="size-4" />
              Invite
            </Button>
            <Button variant="outline">
              <Lock className="size-4" />
              Lock
            </Button>
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-8rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4">
            <Panel className="relative min-h-[420px] overflow-hidden p-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,0.25),transparent_25rem),linear-gradient(135deg,#111827,#030712)]" />
              <div className="relative flex h-full min-h-[420px] flex-col justify-between p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge tone={syncWarning ? "warning" : extensionPaired ? "sync" : "warning"}>
                      {syncWarning
                        ? "Wrong Netflix title"
                        : extensionPaired
                          ? "Sync connected"
                          : "Netflix tab not paired"}
                    </Badge>
                    <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-normal md:text-6xl">
                      {syncWarning
                        ? "Switch to the host's Netflix title to rejoin sync."
                        : "Open your Netflix title, then pair the extension."}
                    </h2>
                    {syncWarning && (
                      <div className="mt-5 max-w-2xl rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-50">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-200" />
                          <div className="grid gap-3">
                            <p>
                              Host is watching{" "}
                              <span className="font-semibold">
                                {syncWarning.expectedTitleHint ?? syncWarning.expectedWatchId}
                              </span>
                              . Your tab is on{" "}
                              <span className="font-semibold">
                                {syncWarning.currentTitleHint ?? syncWarning.currentWatchId}
                              </span>
                              .
                            </p>
                            <Button asChild size="sm" variant="outline">
                              <a href={syncWarning.expectedUrl} target="_blank" rel="noreferrer">
                                <ExternalLink className="size-4" />
                                Open host title
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <Panel className="w-full max-w-sm p-4">
                    <p className="text-sm font-semibold">Extension checklist</p>
                    <ul className="mt-3 grid gap-2 text-sm text-white/65">
                      <li className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-300" />
                        CueRoom extension installed
                      </li>
                      <li className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${extensionPaired ? "bg-emerald-300" : "bg-amber-300"}`}
                        />
                        {extensionPaired ? "Realtime sync connected" : "Netflix watch tab pending"}
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-white/25" />
                        Pairing token ready
                      </li>
                    </ul>
                    <Input
                      className="mt-3"
                      value={extensionId}
                      onChange={(event) => setExtensionId(event.target.value)}
                      placeholder="Extension ID"
                      aria-label="CueRoom extension ID"
                    />
                  </Panel>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => void connectExtension()}
                    disabled={!roomSession || extensionBusy || !extensionId.trim()}
                  >
                    <Play className="size-4" />
                    {extensionBusy ? "Pairing..." : "Pair extension"}
                  </Button>
                  <Button variant="secondary">
                    <SkipForward className="size-4" />
                    Catch up
                  </Button>
                  {!roomSession && (
                    <Button
                      variant="outline"
                      onClick={() => toast.message("Create or join a room to start the call")}
                    >
                      <LogIn className="size-4" />
                      Join call
                    </Button>
                  )}
                  <span className="text-sm text-white/50">
                    CueRoom never sees Netflix video or credentials.
                  </span>
                </div>
              </div>
            </Panel>

            <LiveCallPanel call={call} session={roomSession} />
          </div>

          {chatOpen && (
            <Panel className="grid min-h-[420px] grid-rows-[auto_1fr_auto] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div>
                  <h2 className="font-semibold">Chat</h2>
                  <p className="text-sm text-white/50">Ephemeral by default</p>
                </div>
                <Badge>
                  <Users className="size-3.5" />
                  {participantCount}
                </Badge>
              </div>
              <div className="grid content-start gap-3 overflow-auto p-4">
                {messages.map((chatMessage) => (
                  <div
                    key={chatMessage.id}
                    className={chatMessage.system ? "text-sm text-cyan-100/80" : "grid gap-1"}
                  >
                    {!chatMessage.system && (
                      <p className="text-xs text-white/45">{chatMessage.sender}</p>
                    )}
                    <p className="rounded-lg bg-white/10 px-3 py-2 text-sm">{chatMessage.body}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 border-t border-white/10 p-3">
                <Input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendMessage();
                    }
                  }}
                  placeholder="Message room"
                  aria-label="Message room"
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  aria-label="Send message"
                  title="Send message"
                >
                  <Send className="size-4" />
                </Button>
              </div>
            </Panel>
          )}
        </section>

        <nav className="fixed bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/70 p-2 shadow-2xl backdrop-blur">
          <Button
            size="icon"
            variant={micEnabled ? "secondary" : "outline"}
            onClick={() => void toggleMic()}
            disabled={roomSession ? !call.canControlMedia || call.operationPending : false}
            aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant={cameraEnabled ? "secondary" : "outline"}
            onClick={() => void toggleCamera()}
            disabled={roomSession ? !call.canControlMedia || call.operationPending : false}
            aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
            title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
          >
            {cameraEnabled ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant={chatOpen ? "secondary" : "outline"}
            onClick={() => setChatOpen((open) => !open)}
            aria-label="Toggle chat"
            title="Toggle chat"
          >
            <MessageCircle className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="destructive"
            onClick={() => void leaveRoom()}
            aria-label="Leave room"
            title="Leave room"
          >
            <PhoneOff className="size-4" />
          </Button>
        </nav>
      </div>
    </main>
  );
}
