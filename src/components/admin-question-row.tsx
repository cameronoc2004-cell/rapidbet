"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  deleteQuestion,
  settleQuestionAction,
  updateQuestion,
  voidQuestionAction,
} from "@/app/admin/actions";

export interface AdminQuestionRowProps {
  id: number;
  title: string;
  status: "open" | "locked" | "voided" | "settled";
  window: string;
  entryFeeMinor: number;
  locksAt: string;            // ISO
  hasEntries: boolean;
  entryCount: number;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function AdminQuestionRow(props: AdminQuestionRowProps) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const editable = props.status === "open";
  const deletable = props.status !== "settled" && !props.hasEntries;

  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      {mode === "view" && (
        <>
        <div className="flex items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              #{props.id} · {props.window} · {statusLabel(props.status)}
            </div>
            <div className="mt-1 truncate text-sm text-[var(--text)]">{props.title}</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 font-mono text-[11px] text-[var(--text-muted)]">
              {(() => {
                const potMinor = props.entryCount * props.entryFeeMinor;
                // 5% rake on the gross pool. Stays in sync with
                // COMMISSION_RATE_BPS without re-deriving from settle math.
                const rakeMinor = Math.floor((potMinor * 500) / 10_000);
                return (
                  <>
                    <span>
                      pot ${(potMinor / 100).toFixed(2)}
                    </span>
                    <span className="text-[var(--primary)]">
                      rake ${(rakeMinor / 100).toFixed(2)}
                    </span>
                  </>
                );
              })()}
              <span>
                {props.entryCount} player{props.entryCount === 1 ? "" : "s"}
              </span>
              <span>
                ${(props.entryFeeMinor / 100).toFixed(2)} buy-in
              </span>
              <span>
                locks {new Date(props.locksAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {editable && (
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="text-[11px] text-[var(--text-muted)] underline-offset-2 transition-colors hover:text-white hover:underline"
              >
                Edit
              </button>
            )}
            {deletable && (
              <button
                type="button"
                onClick={() => setMode("confirmDelete")}
                className="text-[11px] text-[var(--text-muted)] underline-offset-2 transition-colors hover:text-[var(--danger)] hover:underline"
              >
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Inline Settle + Void — visible whenever the question is still
            unsettled. Settle takes the official numeric result; Void cancels
            and refunds every entry, with an optional reason logged to audit. */}
        {props.status === "open" && (
          <div className="grid gap-2 border-t border-[var(--border)] p-3 sm:grid-cols-2">
            <form action={settleQuestionAction} className="flex items-end gap-2">
              <input type="hidden" name="questionId" value={props.id} />
              <label className="flex-1">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Official result
                </span>
                <input
                  name="officialResult"
                  type="number"
                  step="0.5"
                  required
                  inputMode="decimal"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                />
              </label>
              <SettleButton />
            </form>

            <form action={voidQuestionAction} className="flex items-end gap-2">
              <input type="hidden" name="questionId" value={props.id} />
              <label className="flex-1">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Void reason (optional)
                </span>
                <input
                  name="reason"
                  type="text"
                  placeholder="e.g. game cancelled"
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                />
              </label>
              <VoidButton />
            </form>
          </div>
        )}
        </>
      )}

      {mode === "confirmDelete" && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
          <span className="text-sm text-[var(--text)]">Delete #{props.id}?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("view")}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-white"
            >
              Cancel
            </button>
            <form action={deleteQuestion}>
              <input type="hidden" name="questionId" value={props.id} />
              <DeleteButton />
            </form>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <form
          action={updateQuestion}
          className="space-y-3 p-3"
        >
          <input type="hidden" name="questionId" value={props.id} />
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Question
            </span>
            <input
              name="title"
              defaultValue={props.title}
              required
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>
          {!props.hasEntries && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Quarter
                </span>
                <select
                  name="window"
                  defaultValue={props.window}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                >
                  {["Q1", "Q2", "Q3", "Q4", "OT", "GAME"].map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Locks
                </span>
                <input
                  type="datetime-local"
                  name="locksAt"
                  defaultValue={toLocalInput(props.locksAt)}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs text-[var(--text)] outline-none focus:border-[var(--primary)]"
                />
              </label>
              <label className="block">
                <span className="block text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Fee
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="entryFeeUsd"
                  defaultValue={(props.entryFeeMinor / 100).toFixed(2)}
                  className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                />
              </label>
            </div>
          )}
          {props.hasEntries && (
            <p className="text-[10px] text-[var(--text-muted)]">
              Only the question text can change once players have entered.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode("view")}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-white"
            >
              Cancel
            </button>
            <SaveButton />
          </div>
        </form>
      )}
    </li>
  );
}

function statusLabel(s: string): string {
  return s.toUpperCase();
}

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--danger)]/85 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Confirm delete"}
    </button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg)] hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function SettleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg)] hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Settling…" : "Settle"}
    </button>
  );
}

function VoidButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--danger)]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Voiding…" : "Void"}
    </button>
  );
}
