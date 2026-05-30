"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Input, Panel } from "@cueroom/ui";
import { CheckCircle2, Copy, ExternalLink, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { AccountSession, MagicLinkRequestResult } from "@/lib/api";
import { CueRoomApiError, getAccount, requestMagicLink } from "@/lib/api";
import {
  accountSessionChangedEvent,
  clearAccountSession,
  readAccountSession
} from "@/lib/account-session";

export function AccountPanel() {
  const [accountSession, setAccountSession] = useState<AccountSession | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [requestResult, setRequestResult] = useState<MagicLinkRequestResult | null>(null);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function syncStoredSession() {
      const storedSession = readAccountSession();
      setAccountSession(storedSession);
      if (!storedSession) {
        return;
      }

      setEmail(storedSession.account.email);
      setDisplayName(storedSession.account.displayName);
      setIsRefreshing(true);
      void getAccount(storedSession.accountSessionToken)
        .then((account) => {
          if (cancelled) {
            return;
          }
          setAccountSession({ ...storedSession, account });
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }
          if (error instanceof CueRoomApiError && [401, 403].includes(error.status)) {
            clearAccountSession();
            setAccountSession(null);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsRefreshing(false);
          }
        });
    }

    syncStoredSession();
    window.addEventListener(accountSessionChangedEvent, syncStoredSession);
    window.addEventListener("storage", syncStoredSession);
    return () => {
      cancelled = true;
      window.removeEventListener(accountSessionChangedEvent, syncStoredSession);
      window.removeEventListener("storage", syncStoredSession);
    };
  }, []);

  async function handleRequestMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return;
    }

    setIsRequesting(true);
    setRequestResult(null);
    setRequestMessage(null);
    try {
      const result = await requestMagicLink({
        email: trimmedEmail,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {})
      });
      setRequestResult(result);
      setRequestMessage("Check your email for a single-use sign-in link.");
      toast.success("Magic link requested");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not request magic link";
      setRequestMessage(message);
      toast.error(message);
    } finally {
      setIsRequesting(false);
    }
  }

  function handleSignOut() {
    clearAccountSession();
    setAccountSession(null);
    setRequestResult(null);
    setRequestMessage(null);
    toast.message("Signed out on this browser");
  }

  if (accountSession) {
    return (
      <Panel className="grid max-w-2xl gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone="success">
            <CheckCircle2 className="size-3.5" />
            Signed in
          </Badge>
          {isRefreshing && (
            <span className="inline-flex items-center gap-2 text-xs text-white/50">
              <Loader2 className="size-3.5 animate-spin" />
              Refreshing
            </span>
          )}
        </div>
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{accountSession.account.displayName}</h2>
          <p className="break-all text-sm text-white/60">{accountSession.account.email}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-white/50">
            Room creation uses this account session. CueRoom still never sees Netflix video,
            cookies, credentials, or DRM data.
          </p>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="grid max-w-2xl gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="warning">
          <ShieldCheck className="size-3.5" />
          Account required in production
        </Badge>
        <span className="text-xs text-white/50">Magic-link sign-in</span>
      </div>
      <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleRequestMagicLink}>
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          placeholder="Email"
          aria-label="Email"
          autoComplete="email"
        />
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          maxLength={48}
          placeholder="Display name"
          aria-label="Display name"
          autoComplete="name"
        />
        <Button type="submit" disabled={isRequesting || !email.trim()}>
          {isRequesting ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Sign in
        </Button>
      </form>
      {requestMessage && <p className="text-sm text-white/60">{requestMessage}</p>}
      {requestResult?.devLink && (
        <div className="grid gap-2 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-50">
          <p className="font-medium">Development magic link returned by the API</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={requestResult.devLink}>
                <ExternalLink className="size-4" />
                Open link
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(requestResult.devLink ?? "");
                toast.success("Development link copied");
              }}
            >
              <Copy className="size-4" />
              Copy
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}
