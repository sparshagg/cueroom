import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge, Button, Panel } from "@cueroom/ui";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  ExternalLink,
  LockKeyhole,
  MessageSquare,
  ShieldCheck,
  Users
} from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export const metadata: Metadata = {
  title: "Privacy Policy | CueRoom",
  description:
    "CueRoom privacy policy and Chrome Web Store Limited Use disclosure for private co-watch rooms."
};

const handledData = [
  "Account data: optional email address or passkey credential metadata for hosts who sign in.",
  "Room data: room IDs, invite codes, participant display names, participant roles, room lock state, and short-lived room session tokens.",
  "Playback sync metadata: Netflix watch URL fingerprint, title hint, paused state, current time, duration, playback rate, buffering state, timestamp, and sequence number.",
  "Call metadata: LiveKit participant identity, room identity, media mute/camera state, and connection state.",
  "Chat data: in-room chat messages while the room is active. Chat is not persisted by default.",
  "Abuse report data: reporter participant ID, reported participant ID, reason, optional bounded details, room ID, and timestamp when a participant submits a room report.",
  "Security data: minimal audit events and rate-limit state needed to protect rooms and investigate abuse."
];

const excludedData = [
  "No Netflix credentials.",
  "No Netflix cookies.",
  "No Netflix account data.",
  "No Netflix DRM keys.",
  "No Netflix subtitles.",
  "No Netflix screenshots, frames, video, or audio.",
  "No call recording.",
  "No advertising identifiers."
];

const usage = [
  "Create and join private watch rooms.",
  "Authorize room roles, invite tokens, and room lock/kick actions.",
  "Mint scoped LiveKit tokens for room audio/video calls.",
  "Sync local playback state between participants who each use their own lawful Netflix session.",
  "Show wrong-title warnings and manual navigation links when participants are not on the same Netflix watch page.",
  "Detect abuse, enforce rate limits, debug service health, and respond to security reports.",
  "Receive and triage room participant reports without inspecting Netflix content or call media."
];

const limitedUse = [
  "CueRoom uses Chrome extension data only to provide or improve the single user-facing purpose of private co-watch rooms with playback sync.",
  "CueRoom transfers extension data only when necessary to provide the room sync feature, protect security, comply with law, or operate the open-source service.",
  "CueRoom does not sell personal data, use personal data for targeted advertising, or transfer extension user data to advertising platforms or data brokers.",
  "CueRoom does not use or transfer extension data for personalized advertising.",
  "CueRoom does not allow humans to read room data except with user consent for support, for security investigation, to comply with law, or in aggregated/anonymized operational form.",
  "CueRoom's use of information received from Chrome extension APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements."
];

const retention = [
  "Room pairing data is stored locally in extension storage and can be removed by disconnecting the extension.",
  "Room session data is stored in web sessionStorage for the current browser session.",
  "Redis data such as invites, room state, presence, sync counters, and rate limits is ephemeral.",
  "PostgreSQL stores only minimal account and room metadata needed for private rooms.",
  "PostgreSQL stores room participant reports so maintainers can investigate abuse; report responses and logs omit free-text report details by default.",
  "Chat messages are not persisted by default."
];

const choices = [
  "Do not install or pair the extension if you do not want CueRoom to observe local playback metadata.",
  "Disconnect the extension from the popup to remove the local room pairing.",
  "Leave a room to stop room presence, chat, sync, and call participation.",
  "Disable microphone or camera at any time from room controls.",
  "Submit room participant reports without including Netflix content, credentials, invite links, account tokens, or private room links."
];

const policySections = [
  { title: "Data CueRoom Handles", items: handledData, icon: Database },
  { title: "Data CueRoom Does Not Handle", items: excludedData, icon: ShieldCheck },
  { title: "How CueRoom Uses Data", items: usage, icon: Users },
  { title: "Chrome Web Store Limited Use", items: limitedUse, icon: LockKeyhole },
  { title: "Storage And Retention", items: retention, icon: MessageSquare },
  { title: "User Choices", items: choices, icon: CheckCircle2 }
];

export default async function PrivacyPage() {
  await connection();

  return (
    <main className="min-h-screen px-4 py-6 text-white md:px-8">
      <div className="mx-auto grid max-w-6xl gap-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/">
                <ArrowLeft className="size-4" />
                Home
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="https://github.com/sparshagg/cueroom" target="_blank">
                Source
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid content-center gap-5">
            <Badge tone="sync" className="w-fit max-w-full whitespace-normal">
              <ShieldCheck className="size-3.5" />
              Privacy policy and Limited Use disclosure
            </Badge>
            <div className="grid gap-4">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-200/75">
                Last updated May 29, 2026
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal md:text-6xl">
                Privacy Policy
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-white/65">
                CueRoom is an open-source, non-affiliated co-watch companion for private watch rooms
                with video calls, chat, and Netflix playback sync. CueRoom does not stream, record,
                inspect, or redistribute Netflix video or audio.
              </p>
              <p className="max-w-3xl text-sm leading-6 text-white/55">
                CueRoom is not affiliated with, endorsed by, sponsored by, or approved by Netflix.
              </p>
            </div>
          </div>

          <Panel className="grid gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-full bg-cyan-300/15 text-cyan-200">
                <LockKeyhole className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Security Boundary</h2>
                <p className="text-sm text-white/55">What CueRoom will not collect.</p>
              </div>
            </div>
            <ul className="grid gap-2 text-sm leading-6 text-white/70">
              {excludedData.slice(0, 6).map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {policySections.map((section) => {
            const Icon = section.icon;

            return (
              <Panel key={section.title} className="grid content-start gap-4 p-5">
                <div className="flex items-center gap-3">
                  <Icon className="size-5 text-cyan-200" aria-hidden="true" />
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                </div>
                <ul className="grid gap-3 text-sm leading-6 text-white/65">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            );
          })}
        </section>

        <Panel className="grid gap-4 p-5">
          <h2 className="text-xl font-semibold">Contact</h2>
          <ul className="grid gap-3 text-sm leading-6 text-white/65">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-300" />
              <span>Use GitHub issues for non-sensitive privacy questions.</span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-300" />
              <span>
                Use the security reporting path in SECURITY.md for vulnerabilities or sensitive
                privacy reports.
              </span>
            </li>
          </ul>
        </Panel>
      </div>
    </main>
  );
}
