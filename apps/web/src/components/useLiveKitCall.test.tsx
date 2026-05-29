import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RoomSession } from "@cueroom/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLiveKitConnectionDetails } from "@/lib/api";
import { useLiveKitCall } from "./useLiveKitCall";
import { ConnectionState } from "livekit-client";

type Listener = (...args: unknown[]) => void;
type DeviceKind = "audioinput" | "videoinput";

const liveKitMock = vi.hoisted(() => {
  const mockedConnectionState = {
    Connected: "connected",
    Connecting: "connecting",
    Disconnected: "disconnected",
    Reconnecting: "reconnecting",
    SignalReconnecting: "signalReconnecting"
  } as const;

  const mockedRoomEvent = {
    ActiveSpeakersChanged: "activeSpeakersChanged",
    Connected: "connected",
    ConnectionStateChanged: "connectionStateChanged",
    Disconnected: "disconnected",
    LocalTrackPublished: "localTrackPublished",
    LocalTrackUnpublished: "localTrackUnpublished",
    MediaDevicesChanged: "mediaDevicesChanged",
    ParticipantConnected: "participantConnected",
    ParticipantDisconnected: "participantDisconnected",
    Reconnected: "reconnected",
    Reconnecting: "reconnecting",
    TrackMuted: "trackMuted",
    TrackSubscribed: "trackSubscribed",
    TrackUnmuted: "trackUnmuted",
    TrackUnsubscribed: "trackUnsubscribed"
  } as const;

  const mockedTrack = {
    Source: {
      Camera: "camera",
      Microphone: "microphone"
    }
  } as const;

  class FakeParticipant {
    readonly identity: string;
    readonly isLocal: boolean;
    readonly name: string;
    connectionQuality = "excellent";
    isCameraEnabled = false;
    isMicrophoneEnabled = false;
    isSpeaking = false;
    readonly setCameraEnabled = vi.fn(async (enabled: boolean) => {
      this.isCameraEnabled = enabled;
    });
    readonly setMicrophoneEnabled = vi.fn(async (enabled: boolean) => {
      this.isMicrophoneEnabled = enabled;
    });

    constructor(input: { identity: string; isLocal: boolean; name: string }) {
      this.identity = input.identity;
      this.isLocal = input.isLocal;
      this.name = input.name;
    }

    getTrackPublication(source: string) {
      if (source === mockedTrack.Source.Camera && this.isCameraEnabled) {
        return { videoTrack: { sid: `${this.identity}-camera` } };
      }
      if (source === mockedTrack.Source.Microphone && this.isMicrophoneEnabled) {
        return { audioTrack: { sid: `${this.identity}-microphone` } };
      }
      return undefined;
    }
  }

  class FakeRoom {
    static readonly instances: FakeRoom[] = [];

    readonly activeSpeakers: FakeParticipant[] = [];
    readonly connectCalls: Array<{ token: string; url: string }> = [];
    disconnectCalls = 0;
    readonly localParticipant = new FakeParticipant({
      identity: "participant_host",
      isLocal: true,
      name: "Host"
    });
    readonly remoteParticipants = new Map<string, FakeParticipant>();
    removeAllListenersCalls = 0;
    state: (typeof mockedConnectionState)[keyof typeof mockedConnectionState] =
      mockedConnectionState.Disconnected;
    readonly switchActiveDevice = vi.fn(async (kind: DeviceKind, deviceId: string) => {
      this.switchedDevices.push({ deviceId, kind });
    });
    readonly switchedDevices: Array<{ deviceId: string; kind: DeviceKind }> = [];
    private readonly listeners = new Map<string, Set<Listener>>();

    constructor() {
      FakeRoom.instances.push(this);
    }

    on(event: string, listener: Listener) {
      const eventListeners = this.listeners.get(event) ?? new Set<Listener>();
      eventListeners.add(listener);
      this.listeners.set(event, eventListeners);
      return this;
    }

    removeAllListeners() {
      this.removeAllListenersCalls += 1;
      this.listeners.clear();
      return this;
    }

    async connect(url: string, token: string) {
      this.connectCalls.push({ token, url });
      this.state = mockedConnectionState.Connected;
      this.emit(mockedRoomEvent.ConnectionStateChanged, mockedConnectionState.Connected);
      this.emit(mockedRoomEvent.Connected);
    }

    async disconnect() {
      this.disconnectCalls += 1;
      this.state = mockedConnectionState.Disconnected;
      this.emit(mockedRoomEvent.ConnectionStateChanged, mockedConnectionState.Disconnected);
      this.emit(mockedRoomEvent.Disconnected);
    }

    private emit(event: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
    }
  }

  return {
    ConnectionState: mockedConnectionState,
    FakeRoom,
    RoomEvent: mockedRoomEvent,
    Track: mockedTrack
  };
});

vi.mock("livekit-client", () => ({
  ConnectionState: liveKitMock.ConnectionState,
  Room: liveKitMock.FakeRoom,
  RoomEvent: liveKitMock.RoomEvent,
  Track: liveKitMock.Track
}));

vi.mock("@/lib/api", () => ({
  fetchLiveKitConnectionDetails: vi.fn()
}));

const fetchLiveKitConnectionDetailsMock = vi.mocked(fetchLiveKitConnectionDetails);

describe("useLiveKitCall", () => {
  beforeEach(() => {
    liveKitMock.FakeRoom.instances.splice(0);
    fetchLiveKitConnectionDetailsMock.mockResolvedValue({
      token: "fake_call_token_with_enough_entropy",
      url: "ws://livekit.test"
    });
    Object.defineProperty(window.navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: vi.fn(async () => [
          mediaDevice({ deviceId: "mic-1", kind: "audioinput", label: "Studio Mic" }),
          mediaDevice({ deviceId: "camera-1", kind: "videoinput", label: "Desk Camera" }),
          mediaDevice({ deviceId: "speaker-1", kind: "audiooutput", label: "Headphones" })
        ])
      }
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("fetches scoped call details and connects the room without persisting the LiveKit token", async () => {
    const { unmount } = render(<HookHarness session={roomSession} />);

    await waitFor(() =>
      expect(fetchLiveKitConnectionDetailsMock).toHaveBeenCalledWith({
        participantId: "participant_host",
        roomId: "room_12345678",
        sessionToken: "crs_123456789012345678901234"
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe(ConnectionState.Connected)
    );

    const room = liveKitMock.FakeRoom.instances[0];
    expect(room?.connectCalls).toEqual([
      {
        token: "fake_call_token_with_enough_entropy",
        url: "ws://livekit.test"
      }
    ]);
    expect(screen.getByTestId("device-count").textContent).toBe("2");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);

    unmount();

    expect(room?.removeAllListenersCalls).toBe(1);
    expect(room?.disconnectCalls).toBe(1);
  });

  it("enables camera and microphone through explicit user controls", async () => {
    render(<HookHarness session={roomSession} />);
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe(ConnectionState.Connected)
    );

    fireEvent.click(screen.getByRole("button", { name: "Enable camera" }));
    fireEvent.click(screen.getByRole("button", { name: "Enable microphone" }));

    const room = liveKitMock.FakeRoom.instances[0];
    await waitFor(() => expect(room?.localParticipant.setCameraEnabled).toHaveBeenCalledWith(true));
    await waitFor(() =>
      expect(room?.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true)
    );
    expect(screen.getByTestId("camera").textContent).toBe("true");
    expect(screen.getByTestId("microphone").textContent).toBe("true");
  });

  it("switches active input devices through the LiveKit room", async () => {
    render(<HookHarness session={roomSession} />);
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe(ConnectionState.Connected)
    );

    fireEvent.click(screen.getByRole("button", { name: "Switch microphone" }));

    const room = liveKitMock.FakeRoom.instances[0];
    await waitFor(() =>
      expect(room?.switchActiveDevice).toHaveBeenCalledWith("audioinput", "mic-1")
    );
    expect(room?.switchedDevices).toEqual([{ deviceId: "mic-1", kind: "audioinput" }]);
  });

  it("disconnects on explicit leave", async () => {
    render(<HookHarness session={roomSession} />);
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toBe(ConnectionState.Connected)
    );

    fireEvent.click(screen.getByRole("button", { name: "Leave call" }));

    const room = liveKitMock.FakeRoom.instances[0];
    await waitFor(() => expect(room?.disconnectCalls).toBe(1));
    expect(screen.getByTestId("state").textContent).toBe(ConnectionState.Disconnected);
  });
});

function HookHarness({ session }: { session: RoomSession | null }) {
  const call = useLiveKitCall(session);

  return (
    <div>
      <span data-testid="state">{call.connectionState}</span>
      <span data-testid="camera">{String(call.localCameraEnabled)}</span>
      <span data-testid="microphone">{String(call.localMicrophoneEnabled)}</span>
      <span data-testid="device-count">{call.devices.length}</span>
      <button type="button" onClick={() => void call.setCameraEnabled(true)}>
        Enable camera
      </button>
      <button type="button" onClick={() => void call.setMicrophoneEnabled(true)}>
        Enable microphone
      </button>
      <button type="button" onClick={() => void call.switchInputDevice("audioinput", "mic-1")}>
        Switch microphone
      </button>
      <button type="button" onClick={() => void call.disconnect()}>
        Leave call
      </button>
    </div>
  );
}

function mediaDevice(input: {
  deviceId: string;
  kind: "audioinput" | "audiooutput" | "videoinput";
  label: string;
}) {
  return {
    deviceId: input.deviceId,
    groupId: "test-group",
    kind: input.kind,
    label: input.label,
    toJSON: () => input
  } satisfies MediaDeviceInfo;
}

const roomSession: RoomSession = {
  participant: {
    cameraEnabled: false,
    displayName: "Host",
    id: "participant_host",
    joinedAt: "2026-05-29T00:00:00.000Z",
    muted: false,
    role: "host"
  },
  room: {
    createdAt: "2026-05-29T00:00:00.000Z",
    expiresAt: "2026-05-30T00:00:00.000Z",
    id: "room_12345678",
    inviteCode: "invite_12345678",
    locked: false,
    participants: [],
    title: "Movie night"
  },
  sessionToken: "crs_123456789012345678901234"
};
