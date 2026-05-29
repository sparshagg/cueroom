"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Panel } from "@cueroom/ui";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/BrandMark";
import { joinRoom } from "@/lib/api";
import { storeRoomSession } from "@/lib/room-session";

export function JoinRoomForm({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("Guest");
  const [isJoining, setIsJoining] = useState(false);

  async function handleJoinRoom() {
    setIsJoining(true);
    try {
      const session = await joinRoom({ inviteCode, displayName });
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
    <Panel className="grid w-full max-w-lg gap-6 p-6">
      <BrandMark />
      <div>
        <p className="text-sm text-white/50">Invite code</p>
        <h1 className="break-all text-3xl font-semibold">{inviteCode}</h1>
      </div>
      <label className="grid gap-2 text-sm">
        Display name
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={48}
        />
      </label>
      <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">
        <ShieldCheck className="mr-2 inline size-4" />
        Guests receive short-lived room sessions and can be removed by the host.
      </div>
      <Button onClick={handleJoinRoom} disabled={isJoining || !displayName.trim()}>
        {isJoining ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowRight className="size-4" />
        )}
        Continue to lobby
      </Button>
    </Panel>
  );
}
