import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, questions } from "@/db/schema";
import { getCurrentProfileId } from "@/lib/session";
import { submitEntry } from "./actions/entries";
import { TEAM_NAME } from "@/lib/config";

const ERRORS: Record<string, string> = {
  invalid_guess: "Please enter a non-negative number.",
  not_found: "That question no longer exists.",
  closed: "Entries for that question are closed.",
  already_entered: "You already submitted a guess for this question.",
  insufficient_GC: "Not enough Gold Coins.",
  insufficient_SC: "Not enough Sweeps Coins.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; entered?: string }>;
}) {
  const { error, entered } = await searchParams;
  const userId = await getCurrentProfileId();

  const openQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.status, "open"))
    .orderBy(desc(questions.createdAt));

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
        <h1 className="text-2xl font-bold tracking-tight">Open questions</h1>
        <p className="mt-1 text-sm text-neutral-500">
          One pick per quarter. Closest guess wins the pot; ties split evenly.
        </p>
      </section>

      {entered && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
          Entry submitted. Good luck.
        </div>
      )}
      {error && ERRORS[error] && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          {ERRORS[error]}
        </div>
      )}

      {!userId && (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <Link href="/login" className="font-medium underline">
            Sign in
          </Link>{" "}
          to submit a guess.
        </div>
      )}

      {openQuestions.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 px-4 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No open questions right now. Check back at game time.
        </p>
      ) : (
        <div className="space-y-4">
          {openQuestions.map((q) => {
            const mine = myEntries.get(q.id);
            return (
              <article
                key={q.id}
                className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-xs text-neutral-500">
                      {q.gameLabel} · {q.quarter} · {TEAM_NAME}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold">{q.title}</h2>
                    {q.description && (
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        {q.description}
                      </p>
                    )}
                  </div>
                  <div className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium dark:bg-neutral-800">
                    {q.buyInAmount} {q.currency} buy-in
                  </div>
                </div>

                {mine ? (
                  <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
                    Your guess:{" "}
                    <span className="font-semibold">{mine.guessValue}</span>
                  </div>
                ) : userId ? (
                  <form
                    action={submitEntry}
                    className="mt-4 flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="questionId" value={q.id} />
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        Your guess
                      </label>
                      <input
                        name="guess"
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
                      Pay {q.buyInAmount} {q.currency} & enter
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
