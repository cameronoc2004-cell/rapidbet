import Link from "next/link";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, questions } from "@/db/schema";
import { getCurrentProfileId } from "@/lib/session";
import { submitEntry } from "./actions/entries";

const ERRORS: Record<string, string> = {
  invalid_prediction: "Please enter a non-negative number.",
  not_found: "That question no longer exists.",
  not_open: "Entries for that question are not open.",
  locked: "That question has locked.",
  already_entered: "You already submitted a prediction.",
  insufficient: "Not enough virtual balance.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; entered?: string }>;
}) {
  const { error, entered } = await searchParams;
  const userId = await getCurrentProfileId();

  // Open questions joined with their game, plus pool stats.
  const open = await db
    .select({
      q: questions,
      g: games,
      entrantCount: sql<number>`coalesce(count(${entries.id}), 0)::int`.as("entrant_count"),
      poolMinor: sql<number>`coalesce(sum(${entries.feePaidMinor}), 0)::bigint`.as("pool_minor"),
    })
    .from(questions)
    .innerJoin(games, eq(questions.gameId, games.id))
    .leftJoin(entries, eq(entries.questionId, questions.id))
    .where(eq(questions.status, "open"))
    .groupBy(questions.id, games.id)
    .orderBy(asc(questions.locksAt), desc(questions.createdAt));

  const myEntries = userId
    ? new Map(
        (await db.select().from(entries).where(eq(entries.userId, userId))).map(
          (e) => [e.questionId, e],
        ),
      )
    : new Map();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight">Open contests</h1>
        <p className="mt-1 text-sm text-neutral-500">
          One numeric prediction per question. Closest to the official result wins
          the pool (1% operator commission, ties split evenly).
        </p>
      </section>

      {entered && (
        <Banner kind="ok" text="Entry submitted. Good luck." />
      )}
      {error && ERRORS[error] && <Banner kind="err" text={ERRORS[error]} />}

      {!userId && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <Link href="/login" className="font-medium underline">
            Sign in
          </Link>{" "}
          to enter a contest.
        </div>
      )}

      {open.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 px-4 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No open contests right now.
        </p>
      ) : (
        <div className="space-y-4">
          {open.map(({ q, g, entrantCount, poolMinor }) => {
            const mine = myEntries.get(q.id);
            const grossPool = Number(poolMinor);
            return (
              <article
                key={q.id}
                className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-xs text-neutral-500">
                      {g.league} · {g.awayTeam} @ {g.homeTeam} · {q.window}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold">{q.title}</h2>
                    <div className="mt-1 text-xs text-neutral-500">
                      {q.statType} · {q.subject}
                    </div>
                    {q.description && (
                      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                        {q.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-medium dark:bg-neutral-800">
                      Fee {usd(q.entryFeeMinor)} {q.moneyKind === "virtual" ? "VC" : "$"}
                    </span>
                    <span className="text-neutral-500">
                      {entrantCount} entrants · pool {usd(grossPool)}
                    </span>
                    <span className="text-neutral-500">
                      min {q.minEntrants} · locks {formatLocksAt(q.locksAt)}
                    </span>
                  </div>
                </div>

                {mine ? (
                  <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
                    Your prediction:{" "}
                    <span className="font-semibold">{mine.predictionValue}</span>
                  </div>
                ) : userId ? (
                  <form
                    action={submitEntry}
                    className="mt-4 flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="questionId" value={q.id} />
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        Your prediction ({q.statType})
                      </label>
                      <input
                        name="prediction"
                        type="number"
                        step="0.5"
                        min="0"
                        required
                        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                      />
                    </div>
                    <button
                      type="submit"
                      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
                    >
                      Pay {usd(q.entryFeeMinor)} VC & enter
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Banner({ kind, text }: { kind: "ok" | "err"; text: string }) {
  const ok = kind === "ok";
  return (
    <div
      className={
        ok
          ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
      }
    >
      {text}
    </div>
  );
}

function usd(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}

function formatLocksAt(d: Date): string {
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
