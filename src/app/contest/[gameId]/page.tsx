import { notFound, redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, questions, settlements } from "@/db/schema";
import { getCurrentProfileId } from "@/lib/session";
import { submitPrediction, ContestError } from "@/lib/contest";
import { InsufficientFundsError } from "@/db/wallet";
import { revalidatePath } from "next/cache";
import { ContestHeader } from "@/components/contest-header";
import { QuestionCard, type QuestionCardData } from "@/components/question-card";
import { WinOverlay } from "@/components/win-overlay";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ celebrate?: string }>;
}

async function submitAction(formData: FormData): Promise<void> {
  "use server";
  const userId = await getCurrentProfileId();
  if (!userId) redirect("/login");

  const questionId = Number(formData.get("questionId"));
  const predictionValue = Number(formData.get("prediction"));
  try {
    await submitPrediction({ questionId, userId, predictionValue });
  } catch (e) {
    if (e instanceof ContestError) throw new Error(humanize(e.code));
    if (e instanceof InsufficientFundsError) throw new Error("Not enough virtual balance.");
    throw e;
  }

  revalidatePath("/");
  revalidatePath(`/contest/[gameId]`, "page");
}

function humanize(code: string): string {
  return (
    {
      invalid_prediction: "Please enter a non-negative number.",
      not_found: "That question no longer exists.",
      not_open: "Entries for that question are not open.",
      locked: "That question has locked.",
      already_entered: "You already submitted a prediction.",
    }[code] ?? code
  );
}

export default async function ContestPage({ params, searchParams }: PageProps) {
  const { gameId: gameIdRaw } = await params;
  const { celebrate } = await searchParams;
  const gameId = Number(gameIdRaw);
  if (!Number.isInteger(gameId)) notFound();

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) notFound();

  const userId = await getCurrentProfileId();

  const allQuestions = await db
    .select({
      q: questions,
      // Live entrants per question for showing pool size in the header maybe later.
      entrantCount: sql<number>`coalesce(count(${entries.id}), 0)::int`,
      poolMinor: sql<number>`coalesce(sum(${entries.feePaidMinor}), 0)::bigint`,
    })
    .from(questions)
    .leftJoin(entries, eq(entries.questionId, questions.id))
    .where(eq(questions.gameId, gameId))
    .groupBy(questions.id)
    .orderBy(questions.locksAt);

  const myEntries = userId
    ? await db
        .select()
        .from(entries)
        .where(
          and(
            eq(entries.userId, userId),
            inArray(
              entries.questionId,
              allQuestions.map((r) => r.q.id),
            ),
          ),
        )
    : [];
  const myEntryByQ = new Map(myEntries.map((e) => [e.questionId, e]));

  // The "win moment": find the most recent settled question the user won
  // (positive payout) so we can celebrate it.  ?celebrate=1 forces it visible
  // for demoability.
  let celebrateAmountMinor: number | null = null;
  if (userId) {
    const winningEntry = myEntries
      .filter((e) => (e.payoutMinor ?? 0) > 0)
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
    const winningQuestion = allQuestions.find(
      (r) => winningEntry && r.q.id === winningEntry.questionId && r.q.status === "settled",
    );
    if (winningQuestion && winningEntry) {
      celebrateAmountMinor = winningEntry.payoutMinor ?? null;
    }
    // Manual force from URL — handy for showing the overlay during demo without
    // having to time settlement.
    if (celebrate === "1" && celebrateAmountMinor == null) {
      celebrateAmountMinor = 1000; // $10 demo amount
    }
  }

  // Resolve game live label from any settled question (if game is in progress
  // we just show "LIVE"; deeper live state is Phase 2 with the data feed).
  const liveLabel = game.status === "in_progress" ? "LIVE" : null;

  const cards: QuestionCardData[] = allQuestions
    .filter((r) => r.q.status === "open" || (myEntryByQ.get(r.q.id) != null && r.q.status !== "voided"))
    .map((r) => ({
      questionId: r.q.id,
      title: r.q.title,
      description: r.q.description ?? null,
      statType: r.q.statType,
      subject: r.q.subject,
      window: r.q.window,
      entryFeeMinor: r.q.entryFeeMinor,
      locksAt: r.q.locksAt.toISOString(),
      myPrediction: myEntryByQ.get(r.q.id)?.predictionValue ?? null,
    }));

  const settledIds = allQuestions.filter((r) => r.q.status === "settled").map((r) => r.q.id);
  const settlementByQ = settledIds.length > 0
    ? new Map(
        (
          await db
            .select()
            .from(settlements)
            .where(inArray(settlements.questionId, settledIds))
        ).map((s) => [s.questionId, s]),
      )
    : new Map();

  return (
    <div className="space-y-8">
      <ContestHeader
        league={game.league}
        homeTeam={game.homeTeam}
        awayTeam={game.awayTeam}
        startsAt={game.startsAt.toISOString()}
        status={game.status as "scheduled" | "in_progress" | "final" | "cancelled"}
        liveLabel={liveLabel}
      />

      {/* Active / submitted question cards */}
      {cards.length > 0 ? (
        <ul className="space-y-3">
          {cards.map((c) => (
            <li key={c.questionId}>
              <QuestionCard data={c} submitAction={submitAction} signedIn={!!userId} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-6 py-12 text-center text-sm text-[var(--text-muted)]">
          No questions open for this event right now.
        </div>
      )}

      {/* Recently settled — calm row, builds trust */}
      {settledIds.length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Recently settled
          </h2>
          <ul className="mt-3 space-y-2">
            {allQuestions
              .filter((r) => r.q.status === "settled")
              .map((r) => {
                const s = settlementByQ.get(r.q.id);
                const mine = myEntryByQ.get(r.q.id);
                return (
                  <li
                    key={r.q.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/70 px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {r.q.window} · {r.q.statType.replace(/_/g, " ")} · {r.q.subject}
                        </div>
                        <div className="mt-0.5 text-sm text-[var(--text)]">{r.q.title}</div>
                      </div>
                      <div className="text-right text-xs text-[var(--text-muted)]">
                        Official{" "}
                        <span className="font-mono text-[var(--text)]">
                          {s?.officialResult ?? "—"}
                        </span>
                      </div>
                    </div>
                    {mine && (
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">
                          You: <span className="font-mono text-[var(--text)]">{mine.predictionValue}</span>
                          {" · err "}
                          <span className="font-mono">{mine.absError?.toFixed(2)}</span>
                        </span>
                        <span
                          className={
                            (mine.payoutMinor ?? 0) > 0
                              ? "font-mono font-semibold text-[var(--primary)]"
                              : "font-mono text-[var(--text-muted)]"
                          }
                        >
                          {(mine.payoutMinor ?? 0) > 0 ? "+" : ""}
                          {formatPayout(mine.payoutMinor ?? 0)}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {celebrateAmountMinor != null && <WinOverlay amountMinor={celebrateAmountMinor} />}
    </div>
  );
}

function formatPayout(minor: number): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}
