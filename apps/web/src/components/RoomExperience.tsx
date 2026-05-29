"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Input, Panel } from "@cueroom/ui";
import {
  Camera,
  CameraOff,
  Copy,
  Lock,
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
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const inviteUrl = useMemo(() => `https://cueroom.app/join/${roomId}`, [roomId]);

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

  return (
    <main className="min-h-screen px-4 py-4 text-white md:px-6">
      <div className="mx-auto grid max-w-[1500px] gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-sm text-white/50">Room</p>
            <h1 className="text-xl font-semibold">Friday watch room</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success">
              <ShieldCheck className="size-3.5" />
              Invite-only
            </Badge>
            <Badge tone="sync">Sync drift 92 ms</Badge>
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
                    <Badge tone="warning">Netflix tab not paired</Badge>
                    <h2 className="mt-4 max-w-2xl text-4xl font-semibold tracking-normal md:text-6xl">
                      Open your Netflix title, then pair the extension.
                    </h2>
                  </div>
                  <Panel className="w-full max-w-sm p-4">
                    <p className="text-sm font-semibold">Extension checklist</p>
                    <ul className="mt-3 grid gap-2 text-sm text-white/65">
                      <li className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-300" />
                        CueRoom extension installed
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-amber-300" />
                        Netflix watch tab pending
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-white/25" />
                        Pairing token ready
                      </li>
                    </ul>
                  </Panel>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button>
                    <Play className="size-4" />
                    Pair extension
                  </Button>
                  <Button variant="secondary">
                    <SkipForward className="size-4" />
                    Catch up
                  </Button>
                  <span className="text-sm text-white/50">
                    CueRoom never sees Netflix video or credentials.
                  </span>
                </div>
              </div>
            </Panel>

            <div className="grid gap-3 lg:grid-cols-3">
              {["You", "Mira", "Dev"].map((name, index) => (
                <Panel key={name} className="aspect-video overflow-hidden p-3">
                  <div className="flex h-full flex-col justify-between rounded-md bg-black/35 p-3">
                    <div className="flex items-center justify-between">
                      <Badge tone={index === 0 ? "success" : "neutral"}>
                        {index === 0 ? "Host" : "Guest"}
                      </Badge>
                      <Badge tone="sync">Good</Badge>
                    </div>
                    <div className="grid place-items-center">
                      <div className="grid size-16 place-items-center rounded-full bg-cyan-300/15 text-xl font-semibold text-cyan-100">
                        {name[0]}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>{name}</span>
                      <span className="text-white/45">{index === 2 ? "Camera off" : "Live"}</span>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          </div>

          {chatOpen && (
            <Panel className="grid min-h-[420px] grid-rows-[auto_1fr_auto] overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <div>
                  <h2 className="font-semibold">Chat</h2>
                  <p className="text-sm text-white/50">Ephemeral by default</p>
                </div>
                <Badge>
                  <Users className="size-3.5" />3
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
            onClick={() => setMicEnabled((enabled) => !enabled)}
            aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
            title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant={cameraEnabled ? "secondary" : "outline"}
            onClick={() => setCameraEnabled((enabled) => !enabled)}
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
          <Button size="icon" variant="destructive" aria-label="Leave room" title="Leave room">
            <PhoneOff className="size-4" />
          </Button>
        </nav>
      </div>
    </main>
  );
}
