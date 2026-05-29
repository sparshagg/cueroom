import Link from "next/link";
import { Button, Input, Panel } from "@cueroom/ui";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default async function JoinPage({ params }: { params: Promise<{ inviteCode: string }> }) {
  const { inviteCode } = await params;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-6 text-white">
      <Panel className="grid w-full max-w-lg gap-6 p-6">
        <BrandMark />
        <div>
          <p className="text-sm text-white/50">Invite code</p>
          <h1 className="text-3xl font-semibold">{inviteCode}</h1>
        </div>
        <label className="grid gap-2 text-sm">
          Display name
          <Input defaultValue="Guest" maxLength={48} />
        </label>
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm text-cyan-100">
          <ShieldCheck className="mr-2 inline size-4" />
          Guests receive short-lived room sessions and can be removed by the host.
        </div>
        <Button asChild>
          <Link href="/room/demo-room">
            Continue to lobby
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </Panel>
    </main>
  );
}
