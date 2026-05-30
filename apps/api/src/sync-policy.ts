import type { PlaybackState, SyncCorrection, SyncWarning } from "@cueroom/shared";

const largeDriftSeconds = 2.5;
const nudgeDriftSeconds = 0.45;
const pausedDriftSeconds = 0.5;
const playbackRateResetThreshold = 0.02;
const maxNudge = 0.06;

export type AuthoritativePlaybackState = {
  participantId: string;
  state: PlaybackState;
};

type FollowerSyncDecision = {
  correction: SyncCorrection | null;
  warning: SyncWarning | null;
};

export function decideFollowerSync(input: {
  roomId: string;
  participantId: string;
  authority: AuthoritativePlaybackState;
  followerState: PlaybackState;
  now: number;
}): FollowerSyncDecision {
  if (input.authority.state.watchId !== input.followerState.watchId) {
    return {
      correction: null,
      warning: {
        type: "wrong-title",
        roomId: input.roomId,
        participantId: input.participantId,
        expectedWatchId: input.authority.state.watchId,
        expectedTitleHint: input.authority.state.titleHint,
        expectedUrl: input.authority.state.url,
        currentWatchId: input.followerState.watchId,
        currentTitleHint: input.followerState.titleHint,
        detectedAt: input.now
      }
    };
  }

  const targetPosition = expectedPlaybackPosition(input.authority.state, input.now);
  const driftSeconds = targetPosition - input.followerState.currentTime;
  const absoluteDrift = Math.abs(driftSeconds);
  const baseCorrection = {
    roomId: input.roomId,
    participantId: input.participantId,
    authorityParticipantId: input.authority.participantId,
    watchId: input.authority.state.watchId,
    driftSeconds,
    issuedAt: input.now
  };

  if (input.authority.state.paused) {
    if (
      !input.followerState.paused ||
      absoluteDrift >= pausedDriftSeconds ||
      playbackRatesDiffer(input.followerState.playbackRate, input.authority.state.playbackRate)
    ) {
      return {
        correction: {
          ...baseCorrection,
          command: "pause",
          position: targetPosition,
          playbackRate: input.authority.state.playbackRate
        },
        warning: null
      };
    }
    return none();
  }

  if (input.followerState.paused || absoluteDrift >= largeDriftSeconds) {
    return {
      correction: {
        ...baseCorrection,
        command: "catch-up",
        position: targetPosition,
        playbackRate: input.authority.state.playbackRate
      },
      warning: null
    };
  }

  if (absoluteDrift >= nudgeDriftSeconds) {
    return {
      correction: {
        ...baseCorrection,
        command: "catch-up",
        playbackRate: nudgedPlaybackRate(input.authority.state.playbackRate, driftSeconds)
      },
      warning: null
    };
  }

  if (playbackRatesDiffer(input.followerState.playbackRate, input.authority.state.playbackRate)) {
    return {
      correction: {
        ...baseCorrection,
        command: "catch-up",
        playbackRate: input.authority.state.playbackRate
      },
      warning: null
    };
  }

  return none();
}

function expectedPlaybackPosition(state: PlaybackState, now: number) {
  const elapsedSeconds = state.paused ? 0 : Math.max(0, now - state.observedAt) / 1000;
  const position = state.currentTime + elapsedSeconds * state.playbackRate;
  if (state.duration > 0) {
    return Math.min(state.duration, Math.max(0, position));
  }
  return Math.max(0, position);
}

function nudgedPlaybackRate(authorityPlaybackRate: number, driftSeconds: number) {
  const adjustment = driftSeconds > 0 ? maxNudge : -maxNudge;
  return Math.min(3, Math.max(0.25, authorityPlaybackRate + adjustment));
}

function playbackRatesDiffer(left: number, right: number) {
  return Math.abs(left - right) >= playbackRateResetThreshold;
}

function none(): FollowerSyncDecision {
  return {
    correction: null,
    warning: null
  };
}
