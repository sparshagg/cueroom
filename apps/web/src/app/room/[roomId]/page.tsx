import { connection } from "next/server";
import { RoomExperience } from "@/components/RoomExperience";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  await connection();

  const { roomId } = await params;
  return <RoomExperience roomId={roomId} />;
}
