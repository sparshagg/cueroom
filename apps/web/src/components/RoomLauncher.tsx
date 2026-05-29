"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@cueroom/ui";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createRoom, joinRoom } from "@/lib/api";
import { storeRoomSession } from "@/lib/room-session";

export function RoomLauncher() {
  const router = useRouter();
  const [hostName, setHostName] = useState("Host");
  const [roomTitle, setRoomTitle] = useState("Friday watch room");
  const [inviteCode, setInviteCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  async function handleCreateRoom() {
    setIsCreating(true);
    try {
      const session = await createRoom({ hostName, title: roomTitle });
      storeRoomSession(session);
      toast.success("Room created");
      router.push(`/room/${session.room.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create room");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinRoom() {
    const trimmedInvite = inviteCode.trim();
    if (!trimmedInvite) {
      return;
    }

    setIsJoining(true);
    try {
      const session = await joinRoom({ inviteCode: trimmedInvite, displayName: "Guest" });
      storeRoomSession(session);
      toast.success("Joined room");
      router.push(`/room/${session.room.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not join room");
    } finally {
      setIsJoining(false);
    }
  }

  return (
    <div id="create-room" className="grid max-w-2xl gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Input
          value={hostName}
          onChange={(event) => setHostName(event.target.value)}
          maxLength={48}
          placeholder="Host name"
          aria-label="Host name"
        />
        <Input
          value={roomTitle}
          onChange={(event) => setRoomTitle(event.target.value)}
          maxLength={120}
          placeholder="Room title"
          aria-label="Room title"
        />
        <Button
          onClick={handleCreateRoom}
          disabled={isCreating || !hostName.trim() || !roomTitle.trim()}
        >
          {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Create
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void handleJoinRoom();
            }
          }}
          placeholder="Enter invite code"
          aria-label="Enter invite code"
        />
        <Button onClick={handleJoinRoom} disabled={isJoining || !inviteCode.trim()}>
          {isJoining ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          Join room
        </Button>
      </div>
    </div>
  );
}
