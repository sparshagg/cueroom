"use client";

import { useEffect, useState } from "react";
import { Button } from "@cueroom/ui";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { verifyMagicLink } from "@/lib/api";
import { storeAccountSession } from "@/lib/account-session";

type VerificationState = {
  status: "verifying" | "verified" | "error";
  message: string;
};

export function AuthMagicLinkVerifier() {
  const router = useRouter();
  const [state, setState] = useState<VerificationState>({
    status: "verifying",
    message: "Verifying magic link"
  });

  useEffect(() => {
    let cancelled = false;
    const token = readMagicLinkToken(window.location.hash);
    removeHashFromAddressBar();

    if (!token) {
      setState({
        status: "error",
        message: "This magic link is missing or has already been cleaned up."
      });
      return () => {
        cancelled = true;
      };
    }

    void verifyMagicLink(token)
      .then((session) => {
        if (cancelled) {
          return;
        }
        storeAccountSession(session);
        setState({
          status: "verified",
          message: `Signed in as ${session.account.email}`
        });
        toast.success("Signed in");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Magic link verification failed"
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        {state.status === "verifying" && <Loader2 className="size-5 animate-spin text-cyan-200" />}
        {state.status === "verified" && <CheckCircle2 className="size-5 text-emerald-200" />}
        {state.status === "error" && <ShieldAlert className="size-5 text-rose-200" />}
        <div>
          <h1 className="text-2xl font-semibold">
            {state.status === "verifying"
              ? "Checking sign-in link"
              : state.status === "verified"
                ? "Account ready"
                : "Sign-in link failed"}
          </h1>
          <p className="mt-1 text-sm text-white/60">{state.message}</p>
        </div>
      </div>

      <p className="text-sm leading-6 text-white/55">
        CueRoom verifies magic links once and stores only the account session token in this browser.
        Netflix video, cookies, credentials, and DRM data stay outside CueRoom.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.replace("/")}>
          {state.status === "verifying" ? "Back to CueRoom" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

function readMagicLinkToken(hash: string) {
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  const token = new URLSearchParams(fragment).get("token")?.trim() ?? "";
  if (!token.startsWith("cml_") || token.length < 24) {
    return "";
  }
  return token;
}

function removeHashFromAddressBar() {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}
