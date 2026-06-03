import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, questions } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { createQuestion } from "./actions";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminQuestionRow } from "@/components/admin-question-row";

const OK: Record<string, string> = {
  created: "Question posted.",
  updated: "Question updated.",
  deleted: "Question deleted.",
};
const ERR: Record<string, string> = {
  missing_title: "Question can't be empty.",
  missing_locks_at: "Pick a lock time.",
  missing_game: "Pick a game.",
  invalid_fee: "Entry fee must be > 0.",
  invalid_window: "Pick a quarter.",
  invalid_input: "Invalid input.",
  not_found: "Question not found.",
  cant_delete_settled: "Settled questions can't be deleted.",
  has_entries_use_void: "Players have entered — use Void on the contest page (it refunds them).",
  cant_edit_locked: "Locked/settled questions can't be edited.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const { ok, error } = await searchParams;

  const existingGames = await db.select().from(games).orderBy(desc(games.startsAt));

  // Recent admin-created questions for the inline edit/delete rail.
  const recent = await db
    .select()
    .from(questions)
    .orderBy(desc(questions.createdAt))
    .limit(15);
  const entrantsByQ = recent.length > 0
    ? new Map(
        (
          await db
            .select({
              questionId: entries.questionId,
              n: sql<number>`count(*)::int`,
            })
            .from(entries)
            .where(inArray(entries.questionId, recent.map((r) => r.id)))
            .groupBy(entries.questionId)
        ).map((r) => [r.questionId, r.n]),
      )
    : new Map<number, number>();

  // Default lock-time: 15 min from now, rounded to the nearest minute.
  const defaultLocksAt = new Date(Date.now() + 15 * 60_000);
  defaultLocksAt.setSeconds(0, 0);
  const defaultLocksAtStr = toLocalInput(defaultLocksAt);

  return (
    <div className="mx-auto max-w-md space-y-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text)]">
        Enter question
      </h1>

      {ok && OK[ok] && (
        <p className="rounded-md border border-[var(--primary-lo)]/40 bg-[var(--primary-lo)]/10 px-3 py-2 text-sm text-[var(--primary)]">
          {OK[ok]}
        </p>
      )}
      {error && ERR[error] && (
        <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {ERR[error]}
        </p>
      )}

      <form action={createQuestion} className="space-y-4">
        <textarea
          name="title"
          required
          rows={2}
          // Cycle the key on every "ok" so React reset-mounts the textarea
          // after a successful post — defense-in-depth on top of the redirect.
          key={`title-${ok ?? "fresh"}`}
          defaultValue=""
          placeholder="How many points will the home team score in Q1?"
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-base text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/70 focus:border-[var(--primary)]"
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Game
            </span>
            <select
              name="gameId"
              required
              defaultValue={existingGames[0]?.id ?? "new"}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            >
              {existingGames.map((g) => (
                <option key={g.id} value={g.id}>
                  #{g.id} · {g.awayTeam} @ {g.homeTeam}
                </option>
              ))}
              <option value="new">+ New game</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Quarter
            </span>
            <select
              name="window"
              defaultValue="Q1"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            >
              {["Q1", "Q2", "Q3", "Q4", "OT", "GAME"].map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Locks at
            </span>
            <input
              type="datetime-local"
              name="locksAt"
              required
              defaultValue={defaultLocksAtStr}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>

          <label className="block">
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Entry fee
            </span>
            <div className="mt-1.5 flex items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] focus-within:border-[var(--primary)]">
              <span className="px-3 text-sm text-[var(--text-muted)]">$</span>
              <input
                type="number"
                name="entryFeeUsd"
                step="0.01"
                min="0.01"
                required
                defaultValue="1.00"
                className="w-full bg-transparent py-2.5 pr-3 text-sm text-[var(--text)] outline-none"
              />
            </div>
          </label>
        </div>

        <details className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 px-4 py-3">
          <summary className="cursor-pointer text-xs text-[var(--text-muted)]">
            New game fields (used only if Game = + New game)
          </summary>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <input
              name="newLeague"
              placeholder="League"
              defaultValue="NFL"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs text-[var(--text)]"
            />
            <input
              name="newAway"
              placeholder="Away"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs text-[var(--text)]"
            />
            <input
              name="newHome"
              placeholder="Home"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs text-[var(--text)]"
            />
          </div>
        </details>

        <AdminSubmitButton>Post question</AdminSubmitButton>
      </form>

      {/* Recent questions: inline edit + delete */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Recent
          </h2>
          <ul className="space-y-2">
            {recent.map((q) => (
              <AdminQuestionRow
                key={q.id}
                id={q.id}
                title={q.title}
                status={q.status as "open" | "locked" | "voided" | "settled"}
                window={q.window}
                entryFeeMinor={q.entryFeeMinor}
                locksAt={q.locksAt.toISOString()}
                hasEntries={(entrantsByQ.get(q.id) ?? 0) > 0}
              />
            ))}
          </ul>
        </section>
      )}

      <p className="pt-2 text-center text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Settle &amp; void live on each contest page (admin-only buttons).
      </p>
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
