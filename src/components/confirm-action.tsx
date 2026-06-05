"use client";

import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ConfirmActionProps {
  // The trigger renders inline wherever this component is placed.
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  triggerAriaLabel?: string;

  // Dialog copy
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;

  // If set, the user must type this exact string before the confirm button
  // unlocks (e.g. "DELETE"). Use for irreversible actions.
  requireText?: string;

  // Styles the confirm button red.
  destructive?: boolean;

  // The server action that runs on confirm.
  action: () => Promise<void> | void;
}

export function ConfirmAction(props: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const allow = !props.requireText || text.trim() === props.requireText;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function closeDialog() {
    if (pending) return;
    setOpen(false);
    setText("");
  }

  const onConfirm = () => {
    if (!allow || pending) return;
    startTransition(async () => {
      try {
        await props.action();
      } catch {
        // Server actions usually redirect — landing here means an error
        // bubbled. Close and let the parent re-render with the new state.
        setOpen(false);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={props.triggerAriaLabel}
        className={props.triggerClassName}
      >
        {props.triggerLabel}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={closeDialog}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              key="dialog"
              role="dialog"
              aria-modal="true"
              aria-label={props.title}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-6"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeDialog();
              }}
            >
              <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
                <h2 className="font-display text-lg font-bold tracking-tight text-[var(--text)]">
                  {props.title}
                </h2>
                {props.body && (
                  <div className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    {props.body}
                  </div>
                )}

                {props.requireText && (
                  <label className="mt-4 block">
                    <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Type {props.requireText} to confirm
                    </span>
                    <input
                      type="text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      autoFocus
                      autoComplete="off"
                      spellCheck={false}
                      className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 font-mono text-sm tracking-widest text-[var(--text)] outline-none focus:border-[var(--danger)]"
                    />
                  </label>
                )}

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDialog}
                    disabled={pending}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-white disabled:opacity-60"
                  >
                    {props.cancelLabel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={!allow || pending}
                    className={
                      "rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
                      (props.destructive
                        ? "bg-[var(--danger)] text-white hover:bg-[var(--danger)]/85"
                        : "bg-[var(--primary)] text-[var(--bg)] hover:bg-[var(--primary-hi)]")
                    }
                  >
                    {pending ? "…" : (props.confirmLabel ?? "Confirm")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
