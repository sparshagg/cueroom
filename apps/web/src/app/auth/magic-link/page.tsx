import { Panel } from "@cueroom/ui";
import { AuthMagicLinkVerifier } from "@/components/AuthMagicLinkVerifier";
import { BrandMark } from "@/components/BrandMark";

export default function MagicLinkPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-6 text-white">
      <Panel className="grid w-full max-w-lg gap-6 p-6">
        <BrandMark />
        <AuthMagicLinkVerifier />
      </Panel>
    </main>
  );
}
