import { notFound, redirect } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, questions, settlements } from "@/db/schema";
import { getVerificationStatus, requireOnboarded } from "@/lib/session";
import { submitPrediction, ContestError } from "@/lib/contest";
import { InsufficientFundsError } from "@/db/wallet";
import { revalidatePath } from "next/cache";
import { ContestHeader } from "@/components/contest-header";
import { QuestionCard, type QuestionCardData } from "@/components/question-card";
import { WinOverlay } from "@/components/win-overlay";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ celebrate?: string }>;
}

async function submitAction(formData: FormData): Promise<void> {
  "use server";
  const session = await requireOnboarded();
  const userId = session.profile!.id;

  // KYC gate: every entry — virtual or real — requires a verified user.
  // Page itself redirects unverified users to /me, but a direct POST would
  // bypass that without this check.
  const verification = await getVerificationStatus(userId);
  if (verification.status !== "verified") {
    throw new Error(humanize("must_verify"));
  }

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
      must_verify: "Verify your identity to enter contests.",
    }[code] ?? code
  );
}

export default async function ContestPage({ params, searchParams }: PageProps) {
  const session = await requireOnboarded();
  const userId = session.profile!.id;
  const verification = await getVerificationStatus(userId);
  if (verification.status !== "verified") redirect("/me?verify=1");

  const { gameId: gameIdRaw } = await params;
  const { celebrate } = await searchParams;
  const gameId = Number(gameIdRaw);
  if (!Number.isInteger(gameId)) notFound();

  const [game] = await db.select().from(games).where(eq(games.id, gameId)).limit(1);
  if (!game) notFound();

  // Pull all questions for the game once, in order of lock time.
  const qList = await db
    .select()
    .from(questions)
    .where(eq(questions.gameId, gameId))
    .orderBy(asc(questions.locksAt));

  // Pot + entrant snapshot per question.
  const aggregates = qList.length > 0
    ? new Map(
        (
          await db
            .select({
              questionId: entries.questionId,
              entrantCount: sql<number>`count(*)::int`,
              potMinor: sql<number>`coalesce(sum(${entries.feePaidMinor}), 0)::bigint`,
            })
            .from(entries)
            .where(inArray(entries.questionId, qList.map((q) => q.id)))
            .groupBy(entries.questionId)
        ).map((r) => [r.questionId, { entrantCount: r.entrantCount, potMinor: Number(r.potMinor) }]),
      )
    : new Map<number, { entrantCount: number; potMinor: number }>();

  const allMyEntries = await db
    .select()
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        inArray(entries.questionId, qList.map((q) => q.id)),
      ),
    );
  const myEntryByQ = new Map(allMyEntries.map((e) => [e.questionId, e]));

  // ACTIVE QUESTION: the open question with the smallest locksAt that is still
  // in the future. The brief calls for one question per game/quarter at a time;
  // when the active one expires, this query naturally finds the next.
  const now = Date.now();
  const activeQuestion =
    qList.find(
      (q) => q.status === "open" && q.locksAt.getTime() > now,
    ) ?? null;

  // If the user has an entry on a question that has locked but isn't yet
  // settled, surface it as the "current" card too (it'll show submitted state).
  // Once that question settles or voids, the next open question takes over.
  const lockedNotSettledMine = qList.find((q) => {
    const mine = myEntryByQ.get(q.id);
    return (
      mine != null &&
      q.status === "open" === false &&
      q.status !== "settled" &&
      q.status !== "voided"
    );
  }) ?? null;

  const featured = activeQuestion ?? lockedNotSettledMine;

  const card: QuestionCardData | null = featured
    ? {
        questionId: featured.id,
        title: featured.title,
        description: featured.description ?? null,
        statType: featured.statType,
        subject: featured.subject,
        window: featured.window,
        entryFeeMinor: featured.entryFeeMinor,
        locksAt: featured.locksAt.toISOString(),
        potMinor: aggregates.get(featured.id)?.potMinor ?? 0,
        entrantCount: aggregates.get(featured.id)?.entrantCount ?? 0,
        myPrediction: myEntryByQ.get(featured.id)?.predictionValue ?? null,
      }
    : null;

  // Win-overlay logic: most recent settled question the user won.
  let celebrateAmountMinor: number | null = null;
  const winningEntry = allMyEntries
    .filter((e) => (e.payoutMinor ?? 0) > 0)
    .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
  if (winningEntry) celebrateAmountMinor = winningEntry.payoutMinor ?? null;
  if (celebrate === "1" && celebrateAmountMinor == null) celebrateAmountMinor = 1000;

  const liveLabel = game.status === "in_progress" ? "LIVE" : null;

  // "Your entries this game" rail: prior entries that aren't the current card.
  const railEntries = allMyEntries
    .filter((e) => (featured ? e.questionId !== featured.id : true))
    .map((e) => ({
      entry: e,
      question: qList.find((q) => q.id === e.questionId)!,
    }))
    .filter((r) => !!r.question);

  // Settlements for any settled rail entries (to show official result + payout).
  const settledIds = railEntries
    .filter((r) => r.question.status === "settled")
    .map((r) => r.question.id);
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

      {/* The one active card */}
      {card ? (
        <QuestionCard data={card} submitAction={submitAction} signedIn={true} />
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-6 py-12 text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Standby
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            No question open right now. The next one appears when the next
            quarter goes live.
          </p>
        </div>
      )}

      {/* Your entries this game */}
      {railEntries.length > 0 && (
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Your entries this game
          </h2>
          <ul className="mt-3 space-y-2">
            {railEntries
              .sort((a, b) => a.question.locksAt.getTime() - b.question.locksAt.getTime())
              .map(({ entry, question }) => {
                const s = settlementByQ.get(question.id);
                const won = (entry.payoutMinor ?? 0) > 0;
                return (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {question.window} · {question.statType.replace(/_/g, " ")} ·{" "}
                          {question.subject}
                        </div>
                        <div className="mt-0.5 text-sm text-[var(--text)]">
                          {question.title}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-[var(--text-muted)]">
                          You{" "}
                          <span className="font-mono text-[var(--text)]">
                            {entry.predictionValue}
                          </span>
                        </div>
                        {question.status === "settled" && s ? (
                          <div className="font-mono text-[var(--text-muted)]">
                            Official{" "}
                            <span className="text-[var(--text)]">
                              {s.officialResult}
                            </span>
                          </div>
                        ) : (
                          <div className="font-mono text-[var(--text-muted)]">
                            {statusLabel(question.status)}
                          </div>
                        )}
                      </div>
                    </div>
                    {question.status === "settled" && (
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">
                          err{" "}
                          <span className="font-mono">{entry.absError?.toFixed(2)}</span>
                        </span>
                        <span
                          className={
                            won
                              ? "font-mono font-semibold text-[var(--primary)]"
                              : "font-mono text-[var(--text-muted)]"
                          }
                        >
                          {won ? "+" : ""}
                          {formatMoney(entry.payoutMinor ?? 0)}
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

function statusLabel(s: string): string {
  switch (s) {
    case "open":
      return "OPEN";
    case "locked":
      return "LOCKED";
    case "settled":
      return "SETTLED";
    case "voided":
      return "VOIDED";
    default:
      return s.toUpperCase();
  }
}
