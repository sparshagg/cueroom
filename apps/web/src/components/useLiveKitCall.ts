"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type Participant,
  type RemoteAudioTrack,
  type RemoteVideoTrack
} from "livekit-client";
import type { RoomSession } from "@cueroom/shared";
import { fetchLiveKitConnectionDetails } from "@/lib/api";

export type LiveKitMediaDevice = Pick<MediaDeviceInfo, "deviceId" | "kind" | "label">;

export type LiveKitParticipantTile = {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
  cameraEnabled: boolean;
  microphoneEnabled: boolean;
  connectionQuality: string;
  videoTrack?: LocalVideoTrack | RemoteVideoTrack;
  audioTrack?: LocalAudioTrack | RemoteAudioTrack;
};

export function useLiveKitCall(session: RoomSession | null) {
  const roomRef = useRef<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected
  );
  const [participants, setParticipants] = useState<LiveKitParticipantTile[]>([]);
  const [devices, setDevices] = useState<LiveKitMediaDevice[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [operationPending, setOperationPending] = useState(false);

  const refreshParticipants = useCallback(() => {
    const room = roomRef.current;
    setParticipants(room ? snapshotParticipants(room) : []);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return;
    }

    const nextDevices = await navigator.mediaDevices.enumerateDevices();
    setDevices(
      nextDevices
        .filter((device) => device.kind === "audioinput" || device.kind === "videoinput")
        .map((device) => ({
          deviceId: device.deviceId,
          kind: device.kind,
          label: device.label
        }))
    );
  }, []);

  useEffect(() => {
    if (!session) {
      roomRef.current = null;
      setConnectionState(ConnectionState.Disconnected);
      setParticipants([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true
    });
    roomRef.current = room;

    const updateConnectionState = (state: ConnectionState) => setConnectionState(state);
    const updateParticipants = () => refreshParticipants();
    const updateDevices = () => void refreshDevices();

    room
      .on(RoomEvent.ConnectionStateChanged, updateConnectionState)
      .on(RoomEvent.Connected, updateParticipants)
      .on(RoomEvent.Reconnected, updateParticipants)
      .on(RoomEvent.Reconnecting, updateParticipants)
      .on(RoomEvent.ParticipantConnected, updateParticipants)
      .on(RoomEvent.ParticipantDisconnected, updateParticipants)
      .on(RoomEvent.TrackSubscribed, updateParticipants)
      .on(RoomEvent.TrackUnsubscribed, updateParticipants)
      .on(RoomEvent.TrackMuted, updateParticipants)
      .on(RoomEvent.TrackUnmuted, updateParticipants)
      .on(RoomEvent.LocalTrackPublished, updateParticipants)
      .on(RoomEvent.LocalTrackUnpublished, updateParticipants)
      .on(RoomEvent.ActiveSpeakersChanged, updateParticipants)
      .on(RoomEvent.MediaDevicesChanged, updateDevices)
      .on(RoomEvent.Disconnected, updateParticipants);

    setConnectionState(ConnectionState.Connecting);
    setErrorMessage(null);

    fetchLiveKitConnectionDetails({
      roomId: session.room.id,
      participantId: session.participant.id,
      sessionToken: session.sessionToken
    })
      .then(({ token, url }) => room.connect(url, token, { autoSubscribe: true }))
      .then(() => {
        if (cancelled) {
          return room.disconnect();
        }
        refreshParticipants();
        void refreshDevices();
      })
      .catch(() => {
        if (!cancelled) {
          setConnectionState(ConnectionState.Disconnected);
          setErrorMessage("Could not connect to the call. Check LiveKit and your room session.");
        }
      });

    return () => {
      cancelled = true;
      room.removeAllListeners();
      roomRef.current = null;
      setParticipants([]);
      void room.disconnect();
    };
  }, [refreshDevices, refreshParticipants, session]);

  const localParticipant = participants.find((participant) => participant.isLocal);
  const canControlMedia = connectionState === ConnectionState.Connected && Boolean(roomRef.current);

  const setCameraEnabled = useCallback(
    async (enabled: boolean) => {
      const room = roomRef.current;
      if (!room) {
        return;
      }
      setOperationPending(true);
      try {
        await room.localParticipant.setCameraEnabled(enabled);
        refreshParticipants();
        void refreshDevices();
      } finally {
        setOperationPending(false);
      }
    },
    [refreshDevices, refreshParticipants]
  );

  const setMicrophoneEnabled = useCallback(
    async (enabled: boolean) => {
      const room = roomRef.current;
      if (!room) {
        return;
      }
      setOperationPending(true);
      try {
        await room.localParticipant.setMicrophoneEnabled(enabled);
        refreshParticipants();
        void refreshDevices();
      } finally {
        setOperationPending(false);
      }
    },
    [refreshDevices, refreshParticipants]
  );

  const switchInputDevice = useCallback(
    async (kind: "audioinput" | "videoinput", deviceId: string) => {
      const room = roomRef.current;
      if (!room || !deviceId) {
        return;
      }
      const deviceKind = kind === "audioinput" ? "audioinput" : "videoinput";
      await room.switchActiveDevice(deviceKind, deviceId);
      void refreshDevices();
    },
    [refreshDevices]
  );

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
    setConnectionState(ConnectionState.Disconnected);
    refreshParticipants();
  }, [refreshParticipants]);

  return useMemo(
    () => ({
      canControlMedia,
      connectionState,
      devices,
      disconnect,
      errorMessage,
      localCameraEnabled: localParticipant?.cameraEnabled ?? false,
      localMicrophoneEnabled: localParticipant?.microphoneEnabled ?? false,
      operationPending,
      participants,
      refreshDevices,
      setCameraEnabled,
      setMicrophoneEnabled,
      switchInputDevice
    }),
    [
      canControlMedia,
      connectionState,
      devices,
      disconnect,
      errorMessage,
      localParticipant?.cameraEnabled,
      localParticipant?.microphoneEnabled,
      operationPending,
      participants,
      refreshDevices,
      setCameraEnabled,
      setMicrophoneEnabled,
      switchInputDevice
    ]
  );
}

function snapshotParticipants(room: Room): LiveKitParticipantTile[] {
  const participants: Participant[] = [
    room.localParticipant,
    ...Array.from(room.remoteParticipants.values())
  ];
  const activeSpeakerIds = new Set(room.activeSpeakers.map((participant) => participant.identity));

  return participants.map((participant) => {
    const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
    const microphonePublication = participant.getTrackPublication(Track.Source.Microphone);

    return {
      identity: participant.identity,
      name: participant.name || participant.identity,
      isLocal: participant.isLocal,
      isSpeaking: activeSpeakerIds.has(participant.identity) || participant.isSpeaking,
      cameraEnabled: participant.isCameraEnabled,
      microphoneEnabled: participant.isMicrophoneEnabled,
      connectionQuality: participant.connectionQuality,
      ...(cameraPublication?.videoTrack ? { videoTrack: cameraPublication.videoTrack } : {}),
      ...(microphonePublication?.audioTrack ? { audioTrack: microphonePublication.audioTrack } : {})
    };
  });
}
