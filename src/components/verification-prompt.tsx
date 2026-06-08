"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { dismissVerificationPrompt, startVerification } from "@/app/verify/actions";

// Post-onboarding "Get Verified" modal.
//
// Rendered by the home page only when the user is fully onboarded but has no
// kyc_records row AND hasn't yet dismissed the prompt. "Skip for now" writes
// kycPromptDismissedAt; "Get Verified" hands off to Didit's hosted UI.
export function VerificationPrompt() {
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <motion.div
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-md rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl sm:rounded-2xl"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--primary)]">
              One more step
            </div>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--text)]">
              Get Verified
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              We verify your identity once so you can enter contests. Takes
              about 60 seconds — a quick photo of your ID and a selfie. You
              can skip this for now and finish later from your profile.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-[var(--text-muted)]">
              <Bullet>Required to enter contests</Bullet>
              <Bullet>One-time check — not stored on our servers</Bullet>
              <Bullet>~60 seconds on your phone</Bullet>
            </ul>

            <div className="mt-6 flex flex-col gap-2">
              <form action={startVerification}>
                <button
                  type="submit"
                  disabled={busy}
                  onClick={() => setBusy(true)}
                  className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40 disabled:cursor-wait disabled:opacity-70"
                >
                  {busy ? "Starting…" : "Get Verified"}
                </button>
              </form>
              {/* onSubmit fires before the action's POST is sent — hide the
                  modal optimistically; the page re-render via revalidatePath
                  cements it. */}
              <form action={dismissVerificationPrompt} onSubmit={() => setOpen(false)}>
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg border border-[var(--border)] bg-transparent px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--primary-lo)] hover:text-[var(--text)] disabled:opacity-50"
                >
                  Skip for now
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--primary)]" />
      <span>{children}</span>
    </li>
  );
}
