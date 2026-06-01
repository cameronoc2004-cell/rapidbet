import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, profiles, questions } from "@/db/schema";
import { getCurrentProfileId } from "@/lib/session";

export default async function ResultsPage() {
  const me = await getCurrentProfileId();

  const resolved = await db
    .select()
    .from(questions)
    .where(eq(questions.status, "resolved"))
    .orderBy(desc(questions.resolvedAt));

  const allEntries = await db.select().from(entries);
  const allProfiles = await db.select().from(profiles);
  const profileById = new Map(allProfiles.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Results</h1>

      {resolved.length === 0 && (
        <p className="text-sm text-neutral-500">No resolved questions yet.</p>
      )}

      {resolved.map((q) => {
        const qEntries = allEntries.filter((e) => e.questionId === q.id);
        const pot = qEntries.reduce((s, e) => s + e.amountPaid, 0);
        const winners = qEntries.filter((e) => (e.wonAmount ?? 0) > 0);
        const mine = me ? qEntries.find((e) => e.userId === me) : undefined;

        return (
          <article
            key={q.id}
            className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <div className="text-xs text-neutral-500">
              {q.gameLabel} · {q.quarter}
            </div>
            <h2 className="mt-1 text-lg font-semibold">{q.title}</h2>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label="Actual" value={String(q.actualValue ?? "—")} />
              <Stat label="Pot" value={`${pot} ${q.currency}`} />
              <Stat label="Entries" value={String(qEntries.length)} />
            </div>

            {mine && (
              <div className="mt-3 rounded-md bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
                Your guess: <span className="font-semibold">{mine.guessValue}</span>{" "}
                · You won:{" "}
                <span
                  className={
                    (mine.wonAmount ?? 0) > 0
                      ? "font-semibold text-emerald-700 dark:text-emerald-400"
                      : "font-semibold text-neutral-500"
                  }
                >
                  {mine.wonAmount ?? 0} {q.currency}
                </span>
              </div>
            )}

            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Winners
              </h3>
              {winners.length === 0 ? (
                <p className="mt-1 text-sm text-neutral-500">No entries.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {winners.map((w) => (
                    <li key={w.id} className="flex justify-between">
                      <span>
                        @{profileById.get(w.userId)?.username ?? "user"} · guess{" "}
                        {w.guessValue}
                      </span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        +{w.wonAmount} {q.currency}
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
