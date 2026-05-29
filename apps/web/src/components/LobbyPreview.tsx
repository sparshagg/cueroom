"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Input, Panel } from "@cueroom/ui";
import { Camera, CameraOff, Mic, MicOff, ShieldCheck, Sparkles } from "lucide-react";

export function LobbyPreview() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [displayName, setDisplayName] = useState("Guest");

  useEffect(() => {
    let stream: MediaStream | null = null;

    if (!cameraEnabled) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch(() => setCameraEnabled(false));

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraEnabled]);

  return (
    <Panel className="grid gap-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Lobby check</h2>
          <p className="text-sm text-white/55">Set your name and devices before joining.</p>
        </div>
        <Badge tone="success">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Private room
        </Badge>
      </div>

      <div className="aspect-video overflow-hidden rounded-lg border border-white/10 bg-black/35">
        {cameraEnabled ? (
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="grid place-items-center gap-3 text-white/60">
              <div className="grid size-16 place-items-center rounded-full bg-white/10 text-xl font-semibold">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
              <span>Camera off</span>
            </div>
          </div>
        )}
      </div>

      <label className="grid gap-2 text-sm">
        Display name
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={48}
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <Button
          variant={cameraEnabled ? "secondary" : "outline"}
          onClick={() => setCameraEnabled((enabled) => !enabled)}
          aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}
        >
          {cameraEnabled ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
          Camera
        </Button>
        <Button
          variant={micEnabled ? "secondary" : "outline"}
          onClick={() => setMicEnabled((enabled) => !enabled)}
          aria-label={micEnabled ? "Mute microphone" : "Unmute microphone"}
        >
          {micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
          Mic
        </Button>
        <Button>
          <Sparkles className="size-4" />
          Join preview
        </Button>
      </div>
    </Panel>
  );
}
