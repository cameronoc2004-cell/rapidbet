import Link from "next/link";
import { and, desc, eq, inArray, sql, asc } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, profiles, questions, settlements } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { createQuestion } from "./actions";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { AdminQuestionRow } from "@/components/admin-question-row";
import { formatMoney } from "@/lib/format";

const OK: Record<string, string> = {
  created: "Question posted.",
  updated: "Question updated.",
  deleted: "Question deleted.",
  voided: "Question voided — all entries refunded.",
  voided_no_entrants: "Voided — no entrants when you settled.",
};
const ERR: Record<string, string> = {
  missing_title: "Enter the question.",
  missing_game: "Pick a game.",
  invalid_game: "That game doesn't exist.",
  missing_window: "Pick a quarter.",
  invalid_window: "Pick a valid quarter.",
  missing_locks_at: "Pick a lock time.",
  invalid_locks_at: "Lock time isn't a valid date.",
  missing_fee: "Enter an entry fee.",
  invalid_fee: "Entry fee must be greater than $0.",
  missing_new_league: "Enter the league for the new game.",
  missing_new_away: "Enter the away team for the new game.",
  missing_new_home: "Enter the home team for the new game.",
  invalid_input: "Invalid input.",
  missing_result: "Enter the official result before settling.",
  invalid_result: "Official result must be a number.",
  not_found: "Question not found.",
  cant_delete_settled: "Settled questions can't be deleted.",
  has_entries_use_void: "Players have entered — use Void on the contest page (it refunds them).",
  cant_edit_locked: "Locked/settled questions can't be edited.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; settled?: string }>;
}) {
  await requireAdmin();
  const { ok, error, settled } = await searchParams;

  // If the admin just settled a question we surface a result card at the top
  // with the full breakdown — pot, 5% rake, net to winners, per-winner payout.
  const settledId = settled ? Number(settled) : null;
  const settlementResult = Number.isFinite(settledId) && settledId != null
    ? await loadSettlement(settledId)
    : null;

  const existingGames = await db.select().from(games).orderBy(desc(games.startsAt));

  // Active + planned questions — anything not yet settled or voided.
  // Sorted by soonest lock first so the next-to-resolve sits at the top.
  const active = await db
    .select()
    .from(questions)
    .where(eq(questions.status, "open"))
    .orderBy(questions.locksAt)
    .limit(30);
  const entrantsByQ = active.length > 0
    ? new Map(
        (
          await db
            .select({
              questionId: entries.questionId,
              n: sql<number>`count(*)::int`,
            })
            .from(entries)
            .where(inArray(entries.questionId, active.map((r) => r.id)))
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
      {settlementResult && (
        <SettleResultCard
          questionTitle={settlementResult.questionTitle}
          officialResult={settlementResult.officialResult}
          grossPoolMinor={settlementResult.grossPoolMinor}
          rakeMinor={settlementResult.commissionMinor}
          netPoolMinor={settlementResult.netPoolMinor}
          winnersCount={settlementResult.winnersCount}
          perWinnerMinor={settlementResult.perWinnerMinor}
          winnerUsernames={settlementResult.winnerUsernames}
        />
      )}

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
          <label className="block min-w-0">
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Game
            </span>
            <select
              name="gameId"
              required
              defaultValue={existingGames[0]?.id ?? "new"}
              className="mt-1.5 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            >
              {existingGames.map((g) => (
                <option key={g.id} value={g.id}>
                  #{g.id} · {g.awayTeam} @ {g.homeTeam}
                </option>
              ))}
              <option value="new">+ New game</option>
            </select>
          </label>

          <label className="block min-w-0">
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Quarter
            </span>
            <select
              name="window"
              defaultValue="Q1"
              className="mt-1.5 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            >
              {["Q1", "Q2", "Q3", "Q4", "OT", "GAME"].map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>

          {/* Locks at gets the full row width on mobile so the native iOS
              datetime picker has room. Goes back to half-width on sm+. */}
          <label className="col-span-2 block min-w-0 sm:col-span-1">
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Locks at
            </span>
            <input
              type="datetime-local"
              name="locksAt"
              required
              defaultValue={defaultLocksAtStr}
              className="mt-1.5 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>

          <label className="col-span-2 block min-w-0 sm:col-span-1">
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
                className="w-full min-w-0 bg-transparent py-2.5 pr-3 text-sm text-[var(--text)] outline-none"
              />
            </div>
          </label>
        </div>

        <details open className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 px-4 py-3">
          <summary className="cursor-pointer text-xs text-[var(--text-muted)]">
            New game fields — required if Game = <span className="text-[var(--text)]">+ New game</span>
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              name="newLeague"
              placeholder="League"
              defaultValue="NFL"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text)]"
            />
            <input
              name="newAway"
              placeholder="Away"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text)]"
            />
            <input
              name="newHome"
              placeholder="Home"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--text)]"
            />
          </div>
        </details>

        <AdminSubmitButton>Post question</AdminSubmitButton>
      </form>

      {/* Active + planned questions: inline settle, void, edit, delete */}
      <section className="space-y-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Active &amp; planned
        </h2>
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            Nothing active. Post one above.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((q) => (
              <AdminQuestionRow
                key={q.id}
                id={q.id}
                title={q.title}
                status={q.status as "open" | "locked" | "voided" | "settled"}
                window={q.window}
                entryFeeMinor={q.entryFeeMinor}
                locksAt={q.locksAt.toISOString()}
                hasEntries={(entrantsByQ.get(q.id) ?? 0) > 0}
                entryCount={entrantsByQ.get(q.id) ?? 0}
              />
            ))}
          </ul>
        )}
      </section>
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

async function loadSettlement(id: number) {
  const [row] = await db
    .select({
      settlement: settlements,
      questionTitle: questions.title,
    })
    .from(settlements)
    .innerJoin(questions, eq(questions.id, settlements.questionId))
    .where(eq(settlements.id, id))
    .limit(1);
  if (!row) return null;

  // Pull the winner usernames for the result card.
  const winnerRows = await db
    .select({ username: profiles.username, payoutMinor: entries.payoutMinor })
    .from(entries)
    .innerJoin(profiles, eq(profiles.id, entries.userId))
    .where(
      and(
        eq(entries.questionId, row.settlement.questionId),
        sql`${entries.payoutMinor} > 0`,
      ),
    );
  return {
    questionTitle: row.questionTitle,
    officialResult: row.settlement.officialResult,
    grossPoolMinor: row.settlement.grossPoolMinor,
    commissionMinor: row.settlement.commissionMinor,
    netPoolMinor: row.settlement.netPoolMinor,
    winnersCount: row.settlement.winnersCount,
    perWinnerMinor: row.settlement.perWinnerMinor,
    winnerUsernames: winnerRows.map((w) => w.username),
  };
}

interface SettleResultCardProps {
  questionTitle: string;
  officialResult: number;
  grossPoolMinor: number;
  rakeMinor: number;
  netPoolMinor: number;
  winnersCount: number;
  perWinnerMinor: number;
  winnerUsernames: string[];
}

function SettleResultCard(props: SettleResultCardProps) {
  const rakePct =
    props.grossPoolMinor > 0
      ? ((props.rakeMinor / props.grossPoolMinor) * 100).toFixed(1)
      : "0.0";
  return (
    <section className="rounded-2xl border border-[var(--primary-lo)]/60 bg-[var(--surface)] p-5 shadow-[0_0_40px_-20px_rgba(22,199,132,0.5)]">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--primary)]">
          Settled
        </div>
        <Link
          href="/admin"
          className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-white"
        >
          Done →
        </Link>
      </div>
      <h2 className="mt-1 font-display text-lg font-semibold leading-snug text-[var(--text)]">
        {props.questionTitle}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Official result:{" "}
        <span className="font-mono text-[var(--text)]">{props.officialResult}</span>
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Total pot" value={formatMoney(props.grossPoolMinor)} />
        <Stat
          label={`Rallypot rake (${rakePct}%)`}
          value={formatMoney(props.rakeMinor)}
          subtle
        />
        <Stat
          label="Net to winners"
          value={formatMoney(props.netPoolMinor)}
          accent
        />
        <Stat
          label={`Winner${props.winnersCount === 1 ? "" : "s"}`}
          value={String(props.winnersCount)}
        />
      </dl>

      <div className="mt-4 rounded-lg border border-[var(--primary-lo)]/40 bg-[var(--primary-lo)]/10 px-3 py-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
          {props.winnersCount === 1 ? "Winner takes" : `Each of ${props.winnersCount} winners gets`}
        </div>
        <div
          className="mt-1 font-mono text-2xl font-bold tracking-tight text-[var(--primary)]"
          data-tabular="true"
        >
          {formatMoney(props.perWinnerMinor)}
        </div>
        {props.winnerUsernames.length > 0 && (
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            {props.winnerUsernames.map((u) => `@${u}`).join(" · ")}
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  accent,
  subtle,
}: {
  label: string;
  value: string;
  accent?: boolean;
  subtle?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={
          "mt-0.5 font-mono text-base font-semibold " +
          (accent
            ? "text-[var(--primary)]"
            : subtle
            ? "text-[var(--text-muted)]"
            : "text-[var(--text)]")
        }
        data-tabular="true"
      >
        {value}
      </div>
    </div>
  );
}
