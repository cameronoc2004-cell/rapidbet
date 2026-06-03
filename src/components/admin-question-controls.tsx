import {
  settleQuestionAction,
  voidQuestionAction,
} from "@/app/admin/actions";

interface AdminQuestionControlsProps {
  questionId: number;
  status: "open" | "locked" | "voided" | "settled";
}

// Admin-only inline widget rendered next to each question on the contest page.
// requireAdmin() inside the server actions is the actual gate — this component
// just hides the controls when the caller already knows the viewer isn't admin.
export function AdminQuestionControls({
  questionId,
  status,
}: AdminQuestionControlsProps) {
  if (status === "settled" || status === "voided") return null;

  return (
    <div className="mt-4 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/60 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Admin
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <form
          action={settleQuestionAction}
          className="flex items-end gap-2"
        >
          <input type="hidden" name="questionId" value={questionId} />
          <label className="flex-1">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Official result
            </span>
            <input
              name="officialResult"
              type="number"
              step="0.5"
              required
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40"
          >
            Settle
          </button>
        </form>

        <form action={voidQuestionAction} className="flex items-end gap-2">
          <input type="hidden" name="questionId" value={questionId} />
          <label className="flex-1">
            <span className="block text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Void reason
            </span>
            <input
              name="reason"
              type="text"
              placeholder="optional"
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--danger)]/60 hover:text-white"
          >
            Void
          </button>
        </form>
      </div>
    </div>
  );
}
