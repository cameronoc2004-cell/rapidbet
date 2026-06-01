"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatMoney } from "@/lib/format";
import { CountdownTimer } from "./countdown-timer";

export interface QuestionCardData {
  questionId: number;
  title: string;
  description: string | null;
  statType: string;
  subject: string;
  window: string;
  entryFeeMinor: number;
  locksAt: string;            // ISO
  // If the user already has an entry on this question, prefill C state.
  myPrediction: number | null;
}

interface QuestionCardProps {
  data: QuestionCardData;
  // Server action that takes a FormData with questionId + prediction.
  submitAction: (formData: FormData) => Promise<void>;
  // When user is not signed in, show a CTA instead of the action panel.
  signedIn: boolean;
}

type CardState = "active" | "buying" | "submitted" | "optedOut" | "expired";

export function QuestionCard(props: QuestionCardProps) {
  const initial: CardState =
    props.data.myPrediction != null
      ? "submitted"
      : new Date(props.data.locksAt).getTime() <= Date.now()
      ? "expired"
      : "active";

  const [state, setState] = useState<CardState>(initial);
  const [predictionInput, setPredictionInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Autofocus the answer entry when entering State B.
  useEffect(() => {
    if (state === "buying") inputRef.current?.focus();
  }, [state]);

  // After the dismiss animations finish (D or E), don't render the card.
  if (state === "optedOut" || state === "expired") {
    return (
      <AnimatePresence>
        <DismissedShell key="dismissed" />
      </AnimatePresence>
    );
  }

  const onSubmit = () => {
    const n = Number(predictionInput);
    if (!Number.isFinite(n) || n < 0) {
      setError("Enter a non-negative number.");
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("questionId", String(props.data.questionId));
    fd.set("prediction", String(n));
    startTransition(async () => {
      try {
        await props.submitAction(fd);
        setState("submitted");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not submit.");
      }
    });
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      {/* Header is shared across A/B/C states */}
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <span className="font-mono">{props.data.window}</span>
            <span>·</span>
            <span>{props.data.statType.replace(/_/g, " ")}</span>
            <span>·</span>
            <span className="text-[var(--text)]">{props.data.subject}</span>
          </div>
          <h3 className="mt-2 font-display text-lg font-semibold leading-snug text-[var(--text)]">
            {props.data.title}
          </h3>
          {props.data.description && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{props.data.description}</p>
          )}
        </div>
        <div className="text-right">
          <CountdownTimer
            locksAt={props.data.locksAt}
            size="sm"
            onExpire={() => {
              // If user already submitted, leave them in State C. Otherwise expire.
              if (state === "active") setState("expired");
            }}
          />
        </div>
      </div>

      {/* Body switches between A / B / C */}
      <div className="mt-5">
        <AnimatePresence mode="wait" initial={false}>
          {state === "active" && !props.signedIn && (
            <SignInPrompt key="signin" />
          )}
          {state === "active" && props.signedIn && (
            <motion.div
              key="a"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setState("optedOut")}
                className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--danger)]/60 hover:text-[var(--danger)]"
              >
                Opt out
              </button>
              <button
                type="button"
                onClick={() => setState("buying")}
                className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] active:bg-[var(--primary-lo)]"
              >
                <span className="font-mono text-base">{formatMoney(props.data.entryFeeMinor)}</span>
                <span className="mx-2 opacity-50">·</span>
                <span>Buy In</span>
              </button>
            </motion.div>
          )}

          {state === "buying" && (
            <motion.div
              key="b"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <label
                className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]"
                htmlFor={`pred-${props.data.questionId}`}
              >
                Your prediction
              </label>
              <input
                id={`pred-${props.data.questionId}`}
                ref={inputRef}
                value={predictionInput}
                onChange={(e) => setPredictionInput(e.target.value)}
                inputMode="decimal"
                type="number"
                step="0.5"
                min="0"
                placeholder="0"
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 font-mono text-3xl font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]"
              />
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Closest answer wins the pool. Operator takes 1% commission;
                ties split the rest evenly.
              </p>
              {error && (
                <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setState("active");
                  }}
                  className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                  disabled={pending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={pending || predictionInput === ""}
                  className="flex-1 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Submitting…" : "Submit answer"}
                </button>
              </div>
            </motion.div>
          )}

          {state === "submitted" && (
            <motion.div
              key="c"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex items-center justify-between rounded-lg border border-[var(--primary-lo)]/40 bg-[var(--primary-lo)]/10 px-3 py-3"
            >
              <div className="flex items-center gap-3">
                <CheckMark />
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--primary)]">
                    You&apos;re in
                  </div>
                  <div className="font-mono text-lg font-semibold text-[var(--text)]">
                    {props.data.myPrediction ?? predictionInput}
                  </div>
                </div>
              </div>
              <div className="text-right text-[11px] text-[var(--text-muted)]">
                Locks in
                <div className="mt-0.5">
                  <CountdownTimer locksAt={props.data.locksAt} size="sm" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}

function SignInPrompt() {
  return (
    <a
      href="/login"
      className="block rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 text-center text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--primary-lo)] hover:text-[var(--text)]"
    >
      Sign in to enter
    </a>
  );
}

function CheckMark() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--primary)]"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.25" opacity="0.4" />
      <path d="m6 10 2.5 2.5L14 7.5" />
    </svg>
  );
}

function DismissedShell() {
  return (
    <motion.div
      initial={{ opacity: 1, x: 0, height: "auto", marginBottom: 16 }}
      animate={{ opacity: 0, x: -24, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      style={{ overflow: "hidden" }}
    />
  );
}
