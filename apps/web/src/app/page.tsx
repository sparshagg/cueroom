import Link from "next/link";
import { Badge, Button, Input, Panel } from "@cueroom/ui";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Github,
  LockKeyhole,
  Play,
  RadioTower,
  ShieldCheck,
  Video
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { LobbyPreview } from "@/components/LobbyPreview";

export default function HomePage() {
  return (
    <main className="min-h-screen px-4 py-6 text-white md:px-8">
      <div className="mx-auto grid max-w-7xl gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="https://github.com/" target="_blank">
                <Github className="size-4" />
                Open source
              </Link>
            </Button>
            <Button asChild>
              <Link href="/room/demo-room">
                Create room
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid gap-6">
            <Badge tone="sync" className="w-fit">
              <ShieldCheck className="size-3.5" />
              Non-affiliated Netflix companion
            </Badge>
            <div className="grid gap-4">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-normal md:text-7xl">
                Private watch rooms with calls, chat, and local sync.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/65">
                CueRoom syncs playback state while everyone watches through their own lawful Netflix
                session. It never sees Netflix video, credentials, cookies, or DRM data.
              </p>
            </div>
            <div className="grid max-w-xl gap-3 sm:grid-cols-[1fr_auto]">
              <Input placeholder="Enter invite code" aria-label="Enter invite code" />
              <Button asChild>
                <Link href="/join/demo-invite">
                  Join room
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["Video calls", Video],
                  ["Ephemeral chat", LockKeyhole],
                  ["Playback sync", RadioTower]
                ] satisfies [string, LucideIcon][]
              ).map(([label, Icon]) => (
                <Panel key={label as string} className="flex items-center gap-3 p-4">
                  <Icon className="size-5 text-cyan-200" aria-hidden="true" />
                  <span className="text-sm text-white/75">{label}</span>
                </Panel>
              ))}
            </div>
          </div>
          <LobbyPreview />
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "No content relay",
              body: "CueRoom does not proxy, record, capture, or decrypt Netflix content.",
              icon: Play
            },
            {
              title: "Invite-only rooms",
              body: "Short-lived links, room locks, role checks, and kick controls are core flows.",
              icon: LockKeyhole
            },
            {
              title: "Minimum permissions",
              body: "The extension is scoped to Netflix watch pages and approved CueRoom origins.",
              icon: ShieldCheck
            }
          ].map((item) => (
            <Panel key={item.title} className="grid gap-3 p-5">
              <item.icon className="size-5 text-cyan-200" />
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="text-sm leading-6 text-white/60">{item.body}</p>
            </Panel>
          ))}
        </section>
      </div>
    </main>
  );
}
