"use client";

import { useEffect, useMemo, useRef } from "react";
import { Badge, Panel } from "@cueroom/ui";
import { CameraOff, MicOff, RadioTower, Volume2 } from "lucide-react";
import {
  ConnectionState,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type RemoteAudioTrack,
  type RemoteVideoTrack
} from "livekit-client";
import type { RoomSession } from "@cueroom/shared";
import type { LiveKitMediaDevice, LiveKitParticipantTile, useLiveKitCall } from "./useLiveKitCall";

type LiveKitCall = ReturnType<typeof useLiveKitCall>;

type PlaceholderTile = {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  connectionQuality: string;
};

const demoTiles: PlaceholderTile[] = [
  {
    identity: "demo-you",
    name: "You",
    isLocal: true,
    isSpeaking: false,
    cameraEnabled: true,
    microphoneEnabled: true,
    connectionQuality: "good"
  },
  {
    identity: "demo-mira",
    name: "Mira",
    isLocal: false,
    isSpeaking: true,
    cameraEnabled: true,
    microphoneEnabled: true,
    connectionQuality: "excellent"
  },
  {
    identity: "demo-dev",
    name: "Dev",
    isLocal: false,
    isSpeaking: false,
    cameraEnabled: false,
    microphoneEnabled: true,
    connectionQuality: "good"
  }
];

export function LiveCallPanel({
  call,
  session
}: {
  call: LiveKitCall;
  session: RoomSession | null;
}) {
  const tiles = useMemo(() => {
    if (call.participants.length > 0) {
      return call.participants;
    }
    if (session) {
      return [
        {
          identity: session.participant.id,
          name: session.participant.displayName,
          isLocal: true,
          isSpeaking: false,
          cameraEnabled: false,
          microphoneEnabled: false,
          connectionQuality: "unknown"
        }
      ];
    }
    return demoTiles;
  }, [call.participants, session]);

  return (
    <div className="grid gap-3">
      <Panel className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={connectionTone(call.connectionState)}>
              <RadioTower className="size-3.5" />
              {connectionLabel(call.connectionState, session)}
            </Badge>
            {call.errorMessage && <Badge tone="danger">{call.errorMessage}</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            <DeviceSelect
              devices={call.devices}
              kind="audioinput"
              label="Microphone"
              onChange={(deviceId) => void call.switchInputDevice("audioinput", deviceId)}
            />
            <DeviceSelect
              devices={call.devices}
              kind="videoinput"
              label="Camera"
              onChange={(deviceId) => void call.switchInputDevice("videoinput", deviceId)}
            />
          </div>
        </div>
        <div className="text-sm text-white/55">
          {session
            ? "Media connects through a room-scoped LiveKit token. Netflix video stays local."
            : "Create or join a room to start the live call."}
        </div>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-3">
        {tiles.map((tile) => (
          <ParticipantTile key={tile.identity} tile={tile} />
        ))}
      </div>

      {call.participants
        .filter((participant) => !participant.isLocal)
        .map((participant) => (
          <AudioTrackSink key={participant.identity} track={participant.audioTrack} />
        ))}
    </div>
  );
}

function ParticipantTile({ tile }: { tile: LiveKitParticipantTile | PlaceholderTile }) {
  return (
    <Panel className="aspect-video overflow-hidden p-3">
      <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-md bg-black/35 p-3">
        {"videoTrack" in tile && tile.videoTrack && tile.cameraEnabled ? (
          <VideoTrackView track={tile.videoTrack} muted={tile.isLocal} />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid size-16 place-items-center rounded-full bg-cyan-300/15 text-xl font-semibold text-cyan-100">
              {tile.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        )}
        <div className="relative z-10 flex items-center justify-between">
          <Badge tone={tile.isLocal ? "success" : "neutral"}>
            {tile.isLocal ? "You" : "Guest"}
          </Badge>
          <Badge tone={tile.isSpeaking ? "sync" : "neutral"}>
            {tile.isSpeaking ? (
              <>
                <Volume2 className="size-3.5" />
                Speaking
              </>
            ) : (
              tile.connectionQuality
            )}
          </Badge>
        </div>
        <div className="relative z-10 flex items-center justify-between rounded-md bg-black/45 px-3 py-2 text-sm backdrop-blur">
          <span>{tile.name}</span>
          <span className="flex items-center gap-2 text-white/55">
            {!tile.microphoneEnabled && <MicOff className="size-4" />}
            {!tile.cameraEnabled && <CameraOff className="size-4" />}
          </span>
        </div>
      </div>
    </Panel>
  );
}

function VideoTrackView({
  muted,
  track
}: {
  muted: boolean;
  track: LocalVideoTrack | RemoteVideoTrack;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    track.attach(video);
    return () => {
      track.detach(video);
    };
  }, [track]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      playsInline
      muted={muted}
    />
  );
}

function AudioTrackSink({ track }: { track?: LocalAudioTrack | RemoteAudioTrack | undefined }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !track) {
      return;
    }

    track.attach(audio);
    return () => {
      track.detach(audio);
    };
  }, [track]);

  return <audio ref={audioRef} autoPlay />;
}

function DeviceSelect({
  devices,
  kind,
  label,
  onChange
}: {
  devices: LiveKitMediaDevice[];
  kind: "audioinput" | "videoinput";
  label: string;
  onChange: (deviceId: string) => void;
}) {
  const matchingDevices = devices.filter((device) => device.kind === kind);

  return (
    <label className="grid gap-1 text-xs text-white/55">
      {label}
      <select
        className="h-9 max-w-44 rounded-lg border border-white/10 bg-black/45 px-3 text-sm text-white outline-none focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20"
        disabled={matchingDevices.length === 0}
        onChange={(event) => onChange(event.target.value)}
        defaultValue=""
      >
        <option value="" disabled>
          {matchingDevices.length === 0 ? "No device yet" : "System default"}
        </option>
        {matchingDevices.map((device, index) => (
          <option key={device.deviceId || `${kind}-${index}`} value={device.deviceId}>
            {device.label || `${label} ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function connectionLabel(connectionState: ConnectionState, session: RoomSession | null) {
  if (!session) {
    return "Call waiting";
  }
  if (connectionState === ConnectionState.Connected) {
    return "Call connected";
  }
  if (
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting
  ) {
    return "Reconnecting";
  }
  if (connectionState === ConnectionState.Connecting) {
    return "Connecting";
  }
  return "Call disconnected";
}

function connectionTone(connectionState: ConnectionState) {
  if (connectionState === ConnectionState.Connected) {
    return "success";
  }
  if (
    connectionState === ConnectionState.Connecting ||
    connectionState === ConnectionState.Reconnecting ||
    connectionState === ConnectionState.SignalReconnecting
  ) {
    return "warning";
  }
  return "neutral";
}
