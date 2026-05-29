import Image from "next/image";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/brand/cueroom-mark.svg"
        alt=""
        width={compact ? 32 : 44}
        height={compact ? 32 : 44}
      />
      <div>
        <p
          className={
            compact
              ? "text-lg font-semibold tracking-normal"
              : "text-2xl font-semibold tracking-normal"
          }
        >
          CueRoom
        </p>
        {!compact && <p className="text-sm text-white/55">Watch together. Stay private.</p>}
      </div>
    </div>
  );
}
