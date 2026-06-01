import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, profiles, questions, settlements } from "@/db/schema";
import { getCurrentProfileId, requireOnboarded } from "@/lib/session";

export default async function ResultsPage() {
  await requireOnboarded();
  const me = await getCurrentProfileId();

  const settled = await db
    .select({ q: questions, g: games, s: settlements })
    .from(questions)
    .innerJoin(games, eq(questions.gameId, games.id))
    .innerJoin(settlements, eq(settlements.questionId, questions.id))
    .where(eq(questions.status, "settled"))
    .orderBy(desc(settlements.resolvedAt));

  const qIds = settled.map((r) => r.q.id);
  const ents = qIds.length > 0
    ? await db.select().from(entries).where(inArray(entries.questionId, qIds))
    : [];
  const userIds = [...new Set(ents.map((e) => e.userId))];
  const profs = userIds.length > 0
    ? await db.select().from(profiles).where(inArray(profiles.id, userIds))
    : [];
  const profileById = new Map(profs.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Results</h1>
      {settled.length === 0 && (
        <p className="text-sm text-neutral-500">No settled contests yet.</p>
      )}

      {settled.map(({ q, g, s }) => {
        const qEntries = ents.filter((e) => e.questionId === q.id);
        const winners = qEntries.filter((e) => (e.payoutMinor ?? 0) > 0);
        const mine = me ? qEntries.find((e) => e.userId === me) : undefined;

        return (
          <article
            key={q.id}
            className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <div className="text-xs text-neutral-500">
              {g.league} · {g.awayTeam} @ {g.homeTeam} · {q.window}
            </div>
            <h2 className="mt-1 text-lg font-semibold">{q.title}</h2>

            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Stat label="Official" value={String(s.officialResult)} />
              <Stat label="Pool" value={`$${(s.grossPoolMinor / 100).toFixed(2)}`} />
              <Stat label="Commission" value={`$${(s.commissionMinor / 100).toFixed(2)}`} />
              <Stat
                label={`Per winner × ${s.winnersCount}`}
                value={`$${(s.perWinnerMinor / 100).toFixed(2)}`}
              />
            </div>

            {mine && (
              <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
                Your prediction:{" "}
                <span className="font-semibold">{mine.predictionValue}</span> · err{" "}
                <span className="font-mono">{mine.absError?.toFixed(2)}</span> ·
                payout{" "}
                <span
                  className={
                    (mine.payoutMinor ?? 0) > 0
                      ? "font-semibold text-emerald-700 dark:text-emerald-400"
                      : "font-semibold text-neutral-500"
                  }
                >
                  ${((mine.payoutMinor ?? 0) / 100).toFixed(2)}
                </span>{" "}
                · skill <span className="font-mono">{mine.skillPointsAwarded ?? 0}</span>
              </div>
            )}

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Winners
              </h3>
              {winners.length === 0 ? (
                <p className="mt-1 text-sm text-neutral-500">No winners.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {winners.map((w) => (
                    <li key={w.id} className="flex justify-between">
                      <span>
                        @{profileById.get(w.userId)?.username ?? "user"} · pred{" "}
                        {w.predictionValue} · err {w.absError?.toFixed(2)}
                      </span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        +${((w.payoutMinor ?? 0) / 100).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}
