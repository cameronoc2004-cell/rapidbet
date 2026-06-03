"use client";

import { useEffect, useState } from "react";
import { firebaseConfigured, registerPushToken } from "@/lib/firebase/client";

type State =
  | "idle"
  | "requesting"
  | "enabled"
  | "denied"
  | "unsupported"
  | "not_configured"
  | "error";

const COPY: Record<Exclude<State, "idle" | "requesting" | "enabled">, string> = {
  denied:
    "Notifications are blocked for this site. Enable them in your browser settings (Site settings → Notifications → Allow), then try again.",
  unsupported:
    "Push notifications aren't supported here. Try a recent Chrome, Edge, Firefox, or Safari.",
  not_configured: "Push isn't configured yet. (Admin: missing NEXT_PUBLIC_FIREBASE_* env.)",
  error: "Something went wrong. Try again.",
};

export function PushToggle() {
  const [state, setState] = useState<State>("idle");

  // Show "enabled" if permission is already granted (rough; we don't fetch
  // the persisted token here — that lives server-side).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setState("unsupported");
      return;
    }
    if (!firebaseConfigured()) {
      setState("not_configured");
      return;
    }
    if (Notification.permission === "denied") setState("denied");
    else if (Notification.permission === "granted") setState("enabled");
  }, []);

  const onEnable = async () => {
    setState("requesting");
    try {
      const token = await registerPushToken();
      const res = await fetch("/api/fcm/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, platform: "web" }),
      });
      if (!res.ok) {
        setState("error");
        return;
      }
      setState("enabled");
    } catch (e) {
      const code = e instanceof Error ? e.message : "error";
      if (code === "denied") setState("denied");
      else if (code === "unsupported") setState("unsupported");
      else if (code === "not_configured") setState("not_configured");
      else setState("error");
    }
  };

  if (state === "enabled") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--primary-lo)]/40 bg-[var(--surface)]/80 p-4">
        <div>
          <div className="font-display text-base font-semibold text-[var(--text)]">
            Push notifications on
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            We&apos;ll ping you when results post and when you win.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
          Enabled
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="font-display text-base font-semibold text-[var(--text)]">
        Push notifications
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Get an instant ping when results post and when you win a pool.
      </p>

      {(state === "idle" || state === "requesting") && (
        <button
          type="button"
          onClick={onEnable}
          disabled={state === "requesting"}
          className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40 disabled:cursor-wait disabled:opacity-70"
        >
          {state === "requesting" ? "Asking your browser…" : "Enable notifications"}
        </button>
      )}

      {state !== "idle" && state !== "requesting" && (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
          {COPY[state]}
          {state !== "denied" && state !== "unsupported" && (
            <button
              type="button"
              onClick={onEnable}
              className="mt-3 inline-block rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-[var(--primary-lo)]"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
