// =============================================================================
// Contest engine — peer-to-peer skill contest.
//
// Money flow is owned by the double-entry ledger (src/db/ledger.ts).
//
//   submit  : available -> held
//   lock    : held      -> pool             (per entry, at settle time)
//   settle  : pool      -> house_rake       (COMMISSION_RATE_BPS of gross)
//             pool      -> winner.available (net, split on ties)
//   void    : held      -> available        (full refund)
//
// Floor of integer division is absorbed into the rake — never lost or
// invented. After settlement, pool MUST net to zero (asserted).
// Settlement is the single point that reads the official result. NEVER
// settle real money on unofficial data. // TODO(vendor: Sportradar / Genius)
// =============================================================================

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  entries,
  questions,
  settlements,
  skillScores,
  type MoneyKind,
} from "@/db/schema";
import {
  getPoolBalance,
  getUserAvailable,
  LedgerError,
} from "@/db/ledger";
import {
  buyIn,
  lockEntry,
  settlePayout,
  settleRake,
  voidRefundFromHeld,
} from "@/lib/ledger-ops";
import { logAudit } from "@/db/audit";
import { COMMISSION_RATE_BPS } from "@/lib/config";
import { notifier } from "@/lib/services";

export interface SubmitPredictionInput {
  questionId: number;
  userId: number;
  predictionValue: number;
}

export interface SubmitPredictionResult {
  entryId: number;
  balanceAfterMinor: number;
}

export class ContestError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
  }
}

export async function submitPrediction(
  input: SubmitPredictionInput,
): Promise<SubmitPredictionResult> {
  if (!Number.isFinite(input.predictionValue) || input.predictionValue < 0) {
    throw new ContestError("invalid_prediction");
  }

  return db.transaction(async (tx) => {
    const [q] = await tx
      .select()
      .from(questions)
      .where(eq(questions.id, input.questionId))
      .for("update")
      .limit(1);
    if (!q) throw new ContestError("not_found");
    if (q.status !== "open") throw new ContestError("not_open");
    if (new Date() > q.locksAt) throw new ContestError("locked");

    const existing = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.questionId, q.id), eq(entries.userId, input.userId)))
      .limit(1);
    if (existing.length > 0) throw new ContestError("already_entered");

    // Insert the entry first so we have an entryId to anchor the buy-in
    // idempotency key against.
    const [created] = await tx
      .insert(entries)
      .values({
        questionId: q.id,
        userId: input.userId,
        predictionValue: input.predictionValue,
        feePaidMinor: q.entryFeeMinor,
        moneyKind: q.moneyKind,
      })
      .returning();

    // available -> held. The ledger row-locks user_available and enforces
    // non-negative within the same DB transaction we're already inside, so
    // concurrent buy-in / withdraw requests serialize and can't double-spend.
    try {
      await buyIn(
        {
          userId: input.userId,
          questionId: q.id,
          entryId: created.id,
          amountMinor: q.entryFeeMinor,
          moneyKind: q.moneyKind as MoneyKind,
        },
        tx,
      );
    } catch (e) {
      if (e instanceof LedgerError && e.code === "insufficient_funds") {
        throw new ContestError("insufficient_funds");
      }
      throw e;
    }

    await logAudit(
      {
        actorUserId: input.userId,
        action: "entry.submit",
        refType: "entry",
        refId: created.id,
        payload: {
          questionId: q.id,
          predictionValue: input.predictionValue,
          feeMinor: q.entryFeeMinor,
          moneyKind: q.moneyKind,
        },
      },
      tx,
    );

    const balanceAfterMinor = await getUserAvailable(
      input.userId,
      q.moneyKind as MoneyKind,
      tx,
    );
    return { entryId: created.id, balanceAfterMinor };
  });
}

// -----------------------------------------------------------------------------

export interface VoidQuestionInput {
  questionId: number;
  actorUserId?: number;
  reason: string;
}

// Refund every entry. Source is user_held (entries haven't moved to pool
// until settle), so this is a held -> available transfer per entrant.
export async function voidQuestion(input: VoidQuestionInput) {
  return db.transaction(async (tx) => {
    const [q] = await tx
      .select()
      .from(questions)
      .where(eq(questions.id, input.questionId))
      .for("update")
      .limit(1);
    if (!q) throw new ContestError("not_found");
    if (q.status === "voided") return { refunded: 0 };
    if (q.status === "settled") throw new ContestError("already_settled");

    const ents = await tx.select().from(entries).where(eq(entries.questionId, q.id));
    for (const e of ents) {
      await voidRefundFromHeld(
        {
          userId: e.userId,
          questionId: q.id,
          entryId: e.id,
          amountMinor: e.feePaidMinor,
          moneyKind: e.moneyKind as MoneyKind,
          actorUserId: input.actorUserId ?? null,
        },
        tx,
      );
    }
    await tx.update(questions).set({ status: "voided" }).where(eq(questions.id, q.id));

    await logAudit(
      {
        actorUserId: input.actorUserId ?? null,
        action: "question.void",
        refType: "question",
        refId: q.id,
        payload: { reason: input.reason, refundedEntries: ents.length },
      },
      tx,
    );

    return { refunded: ents.length };
  });
}

// -----------------------------------------------------------------------------

export interface SettleQuestionInput {
  questionId: number;
  officialResult: number;
  actorUserId?: number;
  officialResultPayload?: Record<string, unknown> | null;
}

export interface SettleQuestionResult {
  settlementId: number;
  grossPoolMinor: number;
  commissionMinor: number;
  netPoolMinor: number;
  winnersCount: number;
  perWinnerMinor: number;
  voided?: boolean;
  winnerUserIds?: number[];
  questionTitle?: string;
}

export async function settleQuestion(
  input: SettleQuestionInput,
): Promise<SettleQuestionResult> {
  if (!Number.isFinite(input.officialResult)) {
    throw new ContestError("invalid_result");
  }

  return db
    .transaction(async (tx) => {
      const [q] = await tx
        .select()
        .from(questions)
        .where(eq(questions.id, input.questionId))
        .for("update")
        .limit(1);
      if (!q) throw new ContestError("not_found");
      if (q.status === "settled") throw new ContestError("already_settled");
      if (q.status === "voided") throw new ContestError("already_voided");

      const ents = await tx.select().from(entries).where(eq(entries.questionId, q.id));

      // Min entrants not met → behaves as a void instead of a settle.
      if (ents.length < q.minEntrants) {
        for (const e of ents) {
          await voidRefundFromHeld(
            {
              userId: e.userId,
              questionId: q.id,
              entryId: e.id,
              amountMinor: e.feePaidMinor,
              moneyKind: e.moneyKind as MoneyKind,
              actorUserId: input.actorUserId ?? null,
            },
            tx,
          );
        }
        await tx
          .update(questions)
          .set({ status: "voided" })
          .where(eq(questions.id, q.id));
        await logAudit(
          {
            actorUserId: input.actorUserId ?? null,
            action: "question.void",
            refType: "question",
            refId: q.id,
            payload: {
              reason: "min_entrants_not_met",
              entrants: ents.length,
              minEntrants: q.minEntrants,
            },
          },
          tx,
        );
        return {
          settlementId: 0,
          grossPoolMinor: 0,
          commissionMinor: 0,
          netPoolMinor: 0,
          winnersCount: 0,
          perWinnerMinor: 0,
          voided: true as const,
        };
      }

      const moneyKind = q.moneyKind as MoneyKind;

      // 1. Lock every entry: held -> pool. After this, the pool account holds
      //    the entire gross stake.
      for (const e of ents) {
        await lockEntry(
          {
            userId: e.userId,
            questionId: q.id,
            entryId: e.id,
            amountMinor: e.feePaidMinor,
            moneyKind,
            actorUserId: input.actorUserId ?? null,
          },
          tx,
        );
      }

      const grossPoolMinor = ents.reduce((s, e) => s + e.feePaidMinor, 0);

      // Compute rake (integer math, floor), winners, per-winner net, and the
      // remainder that goes to rake to keep the pool exactly zero.
      const commissionMinor = Math.floor(
        (grossPoolMinor * COMMISSION_RATE_BPS) / 10_000,
      );
      const baseNetPoolMinor = grossPoolMinor - commissionMinor;

      let bestErr = Infinity;
      for (const e of ents) {
        const err = Math.abs(e.predictionValue - input.officialResult);
        if (err < bestErr) bestErr = err;
      }
      const errors = ents.map((e) => ({
        entry: e,
        err: Math.abs(e.predictionValue - input.officialResult),
      }));
      const winners = errors.filter((x) => x.err === bestErr);
      const perWinnerMinor = Math.floor(baseNetPoolMinor / winners.length);
      const splitRemainderMinor =
        baseNetPoolMinor - perWinnerMinor * winners.length;
      const finalCommissionMinor = commissionMinor + splitRemainderMinor;
      const netPoolMinor = perWinnerMinor * winners.length;

      // 2. Rake: pool -> house_rake.
      if (finalCommissionMinor > 0) {
        await settleRake(
          {
            questionId: q.id,
            amountMinor: finalCommissionMinor,
            moneyKind,
            actorUserId: input.actorUserId ?? null,
          },
          tx,
        );
      }

      // Percentile rank per entry (average-rank, ties share a percentile).
      const sortedByErr = [...errors].sort((a, b) => a.err - b.err);
      const rankByEntryId = new Map<number, number>();
      {
        let i = 0;
        while (i < sortedByErr.length) {
          let j = i;
          while (j + 1 < sortedByErr.length && sortedByErr[j + 1].err === sortedByErr[i].err) {
            j++;
          }
          const avgPosition = (i + j) / 2;
          const percentile =
            sortedByErr.length === 1 ? 1 : 1 - avgPosition / (sortedByErr.length - 1);
          for (let k = i; k <= j; k++) {
            rankByEntryId.set(sortedByErr[k].entry.id, percentile);
          }
          i = j + 1;
        }
      }
      const season = String(new Date(q.createdAt).getUTCFullYear());

      // 3. Payouts: pool -> winner.available. Then skill scores + entry rows.
      for (const x of errors) {
        const isWinner = x.err === bestErr;
        const payout = isWinner ? perWinnerMinor : 0;
        const percentile = rankByEntryId.get(x.entry.id) ?? 0;
        const pointsAwarded = Math.round(percentile * 1000);

        if (isWinner && payout > 0) {
          await settlePayout(
            {
              userId: x.entry.userId,
              questionId: q.id,
              entryId: x.entry.id,
              amountMinor: payout,
              moneyKind,
              actorUserId: input.actorUserId ?? null,
            },
            tx,
          );
        }
        await tx
          .update(entries)
          .set({
            payoutMinor: payout,
            absError: x.err,
            percentileRank: percentile,
            skillPointsAwarded: pointsAwarded,
          })
          .where(eq(entries.id, x.entry.id));
        await tx.insert(skillScores).values({
          userId: x.entry.userId,
          questionId: q.id,
          season,
          absError: x.err,
          percentileRank: percentile,
          pointsAwarded,
        });
      }

      // Hard invariant: after settlement the pool MUST net to zero.
      const poolAfter = await getPoolBalance(q.id, moneyKind, tx);
      if (poolAfter !== 0) {
        throw new ContestError(
          "pool_drift",
          `pool ${q.id} did not zero out after settle: ${poolAfter}`,
        );
      }

      const [settlement] = await tx
        .insert(settlements)
        .values({
          questionId: q.id,
          officialResult: input.officialResult,
          officialResultPayload: input.officialResultPayload ?? null,
          grossPoolMinor,
          commissionMinor: finalCommissionMinor,
          netPoolMinor,
          winnersCount: winners.length,
          perWinnerMinor,
          resolvedBy: input.actorUserId ?? null,
        })
        .returning();

      await tx
        .update(questions)
        .set({ status: "settled" })
        .where(eq(questions.id, q.id));

      await logAudit(
        {
          actorUserId: input.actorUserId ?? null,
          action: "question.settle",
          refType: "settlement",
          refId: settlement.id,
          payload: {
            questionId: q.id,
            officialResult: input.officialResult,
            grossPoolMinor,
            commissionMinor: finalCommissionMinor,
            netPoolMinor,
            winnersCount: winners.length,
            perWinnerMinor,
          },
        },
        tx,
      );

      return {
        settlementId: settlement.id,
        grossPoolMinor,
        commissionMinor: finalCommissionMinor,
        netPoolMinor,
        winnersCount: winners.length,
        perWinnerMinor,
        winnerUserIds: winners.map((w) => w.entry.userId),
        questionTitle: q.title,
      };
    })
    .then(async (result) => {
      // Fire notifications AFTER the tx commits.
      if (!result.voided && result.winnerUserIds && result.perWinnerMinor > 0) {
        const title = result.questionTitle ?? "your contest";
        await Promise.allSettled(
          result.winnerUserIds.map((userId) =>
            notifier.notifyContestWon({
              userId,
              amountMinor: result.perWinnerMinor,
              questionTitle: title,
            }),
          ),
        );
      }
      return result;
    });
}
