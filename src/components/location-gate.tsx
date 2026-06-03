"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface LocationGateProps {
  // Server action that accepts FormData with latitude + longitude.
  verifyAction: (formData: FormData) => Promise<void>;
}

type Status =
  | "idle"
  | "requesting"
  | "submitting"
  | "denied"
  | "unsupported"
  | "outside_permitted_state"
  | "non_us"
  | "lookup_failed"
  | "invalid_coords"
  | "error";

const COPY: Record<Exclude<Status, "idle" | "requesting" | "submitting">, string> = {
  denied:
    "Location permission was denied. We require it to verify your state. Enable location for this site in your browser settings, then try again.",
  unsupported:
    "Your browser doesn't expose geolocation. Try a recent Chrome, Safari, Firefox or Edge.",
  outside_permitted_state:
    "Sorry — we can't offer contests in your state right now. We'll let you know when that changes.",
  non_us:
    "We can only verify US locations right now. The product is US-only.",
  lookup_failed:
    "We couldn't verify your location. Try again, and if it keeps failing, refresh and retry.",
  invalid_coords: "Your device returned coordinates we couldn't read. Try again.",
  error: "Something went wrong verifying your location. Try again.",
};

export function LocationGate({ verifyAction }: LocationGateProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [pending, startTransition] = useTransition();

  const askForLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setStatus("submitting");
        const fd = new FormData();
        fd.set("latitude", String(pos.coords.latitude));
        fd.set("longitude", String(pos.coords.longitude));
        startTransition(async () => {
          try {
            await verifyAction(fd);
            // On success, refresh so /onboarding re-renders with state verified
            // (and maybe redirects home if all three gates are now green).
            router.refresh();
            setStatus("idle");
          } catch (e) {
            const code = e instanceof Error ? e.message : "error";
            if (
              code === "outside_permitted_state" ||
              code === "non_us" ||
              code === "lookup_failed" ||
              code === "invalid_coords"
            ) {
              setStatus(code);
            } else {
              setStatus("error");
            }
          }
        });
      },
      (err) => {
        // PERMISSION_DENIED = 1, POSITION_UNAVAILABLE = 2, TIMEOUT = 3
        if (err.code === err.PERMISSION_DENIED) setStatus("denied");
        else setStatus("lookup_failed");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  const blocked =
    status === "outside_permitted_state" ||
    status === "non_us";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-muted)]">
        We use your device GPS to verify your state. We never accept a
        self-reported location. Your browser will ask permission.
      </div>

      {!blocked && (
        <button
          type="button"
          onClick={askForLocation}
          disabled={status === "requesting" || status === "submitting" || pending}
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40 disabled:cursor-wait disabled:opacity-70"
        >
          {status === "requesting"
            ? "Waiting for your permission…"
            : status === "submitting" || pending
            ? "Verifying location…"
            : "Use my location"}
        </button>
      )}

      {status !== "idle" &&
        status !== "requesting" &&
        status !== "submitting" && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className={
              blocked
                ? "rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]"
                : "rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200"
            }
          >
            {COPY[status as keyof typeof COPY]}
            {!blocked && (
              <button
                type="button"
                onClick={askForLocation}
                className="mt-3 inline-block rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition-colors hover:border-[var(--primary-lo)]"
              >
                Try again
              </button>
            )}
          </motion.div>
        )}
    </div>
  );
}
