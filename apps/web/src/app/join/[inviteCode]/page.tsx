import { JoinRoomForm } from "@/components/JoinRoomForm";

export default async function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-6 text-white">
      <JoinRoomForm inviteCode={inviteCode} />
    </main>
  );
}
