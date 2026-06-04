import Link from "next/link";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, questions } from "@/db/schema";
import { requireOnboarded } from "@/lib/session";
import { formatMoney } from "@/lib/format";
import { CountdownTimer } from "@/components/countdown-timer";
import { RefreshButton } from "@/components/refresh-button";

export const dynamic = "force-dynamic";

export default async function ActivePicksPage() {
  const session = await requireOnboarded();
  const userId = session.profile!.id;

  // Active = entries on questions that are still open (accepting entries) or
  // locked (awaiting settlement). We deliberately exclude settled + voided —
  // those live on /results.
  const rows = await db
    .select({
      entry: entries,
      question: questions,
      game: games,
    })
    .from(entries)
    .innerJoin(questions, eq(questions.id, entries.questionId))
    .innerJoin(games, eq(games.id, questions.gameId))
    .where(
      and(
        eq(entries.userId, userId),
        inArray(questions.status, ["open", "locked"]),
      ),
    )
    .orderBy(asc(questions.locksAt));

  // Pot snapshot per question (sum of fees).
  const qIds = rows.map((r) => r.question.id);
  const pots = qIds.length > 0
    ? new Map(
        (
          await db
            .select({
              qId: entries.questionId,
              potMinor: sql<number>`coalesce(sum(${entries.feePaidMinor}), 0)::bigint`,
              players: sql<number>`count(*)::int`,
            })
            .from(entries)
            .where(inArray(entries.questionId, qIds))
            .groupBy(entries.questionId)
        ).map((r) => [r.qId, { potMinor: Number(r.potMinor), players: r.players }]),
      )
    : new Map<number, { potMinor: number; players: number }>();

  return (
    <div className="space-y-6">
      <section className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text)]">
            Active picks
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Your in-flight entries — open or awaiting the official result.
          </p>
        </div>
        <RefreshButton label="Refresh picks" autoRefreshMs={30_000} />
      </section>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-6 py-12 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Nothing in flight
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Tap <Link href="/" className="text-[var(--primary)] hover:underline">Events</Link> to enter a contest.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ entry, question, game }) => {
            const agg = pots.get(question.id);
            const isOpen = question.status === "open";
            return (
              <li key={entry.id}>
                <Link
                  href={`/contest/${game.id}`}
                  className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary-lo)]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {game.league} · {game.awayTeam} @ {game.homeTeam} · {question.window}
                    </div>
                    <span
                      className={
                        "font-mono text-[10px] uppercase tracking-[0.18em] " +
                        (isOpen ? "text-[var(--primary)]" : "text-amber-300")
                      }
                    >
                      {isOpen ? "OPEN" : "LOCKED"}
                    </span>
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-[var(--text)]">
                    {question.title}
                  </h2>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Stat label="Your pick" value={String(entry.predictionValue)} mono />
                    <Stat
                      label="Pot"
                      value={formatMoney(agg?.potMinor ?? entry.feePaidMinor)}
                      mono
                      accent
                    />
                    <Stat label="Players" value={String(agg?.players ?? 1)} mono />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-[var(--text-muted)]">
                      {isOpen ? "Locks in" : "Awaiting result"}
                    </span>
                    <CountdownTimer locksAt={question.locksAt.toISOString()} size="sm" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={
          "mt-0.5 text-sm font-semibold " +
          (mono ? "font-mono " : "") +
          (accent ? "text-[var(--primary)]" : "text-[var(--text)]")
        }
        data-tabular="true"
      >
        {value}
      </div>
    </div>
  );
}
