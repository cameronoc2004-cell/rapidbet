// =============================================================================
// Contest engine — peer-to-peer skill contest.
//
// Operator never takes a position. Revenue = COMMISSION_RATE_BPS of gross pool,
// taken at settle time. Closest-error wins; ties split netPool evenly.
//
// All money math in integer minor units. Floats are forbidden for money. Any
// fractional cent from an even split stays in the operator's commission bucket
// (i.e. carried as additional commission, not lost). This is auditable.
//
// Settlement is the single point that reads the official result. In Phase 1 the
// admin enters a mock value. In Phase 2 the licensed feed payload is the source
// of truth — see settlements.officialResultPayload. NEVER settle real money on
// unofficial data. // TODO(vendor: Sportradar / Genius Sports)
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
import { postWalletTx } from "@/db/wallet";
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

    // One entry per user per question (enforced by unique index too).
    const existing = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.questionId, q.id), eq(entries.userId, input.userId)))
      .limit(1);
    if (existing.length > 0) throw new ContestError("already_entered");

    // Debit wallet → create entry → audit. All in one tx.
    await postWalletTx(
      {
        userId: input.userId,
        moneyKind: q.moneyKind as MoneyKind,
        deltaMinor: -q.entryFeeMinor,
        reason: "entry_fee",
        refType: "question",
        refId: q.id,
        idempotencyKey: `entry_fee:${q.id}:${input.userId}`,
      },
      tx,
    );

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

    const { balanceAfterMinor } = await getBalanceAfter(tx, input.userId, q.moneyKind as MoneyKind);
    return { entryId: created.id, balanceAfterMinor };
  });
}

async function getBalanceAfter(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: number, moneyKind: MoneyKind) {
  // Used to return the post-tx balance in the same transaction, avoiding an
  // extra round-trip after commit.
  const { wallets } = await import("@/db/schema");
  const [w] = await tx.select().from(wallets).where(eq(wallets.userId, userId));
  return {
    balanceAfterMinor: moneyKind === "virtual" ? w.virtualBalanceMinor : w.realBalanceMinor,
  };
}

// -----------------------------------------------------------------------------

export interface VoidQuestionInput {
  questionId: number;
  actorUserId?: number;
  reason: string;
}

// Void + refund every entry. Used when min_entrants not met by lock time, or
// when the underlying game is cancelled.
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
      await postWalletTx(
        {
          userId: e.userId,
          moneyKind: e.moneyKind as MoneyKind,
          deltaMinor: e.feePaidMinor,
          reason: "entry_refund",
          refType: "question",
          refId: q.id,
          idempotencyKey: `entry_refund:${q.id}:${e.userId}`,
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
  // Phase 1: null. Phase 2: the raw vendor payload that justified officialResult.
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
  // Populated on successful settle (not on void) so the notifier can fire.
  winnerUserIds?: number[];
  questionTitle?: string;
}

export async function settleQuestion(
  input: SettleQuestionInput,
): Promise<SettleQuestionResult> {
  if (!Number.isFinite(input.officialResult)) {
    throw new ContestError("invalid_result");
  }

  return db.transaction(async (tx) => {
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

    // If min entrants not met, this is a void, not a settle.
    if (ents.length < q.minEntrants) {
      // Inline void-refund (caller asked to settle, but we override).
      for (const e of ents) {
        await postWalletTx(
          {
            userId: e.userId,
            moneyKind: e.moneyKind as MoneyKind,
            deltaMinor: e.feePaidMinor,
            reason: "entry_refund",
            refType: "question",
            refId: q.id,
            idempotencyKey: `entry_refund:${q.id}:${e.userId}`,
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
        voided: true,
      };
    }

    // Gross pool = sum of fees.
    const grossPoolMinor = ents.reduce((s, e) => s + e.feePaidMinor, 0);

    // Commission via integer math: floor(gross * bps / 10000).
    const commissionMinor = Math.floor((grossPoolMinor * COMMISSION_RATE_BPS) / 10_000);
    const baseNetPoolMinor = grossPoolMinor - commissionMinor;

    // Winners = entries with the lowest abs error.
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

    // Even split, rounding down. Remainder (in minor units) is absorbed into
    // commission so no cent is lost or invented.
    const perWinnerMinor = Math.floor(baseNetPoolMinor / winners.length);
    const splitRemainderMinor = baseNetPoolMinor - perWinnerMinor * winners.length;
    const finalCommissionMinor = commissionMinor + splitRemainderMinor;
    const netPoolMinor = perWinnerMinor * winners.length;

    // Percentile rank per entry: 1.0 = best (lowest err); 0.0 = worst.
    // Average-rank percentile so ties get the same score.
    const sortedByErr = [...errors].sort((a, b) => a.err - b.err);
    const rankByEntryId = new Map<number, number>();
    {
      let i = 0;
      while (i < sortedByErr.length) {
        let j = i;
        while (j + 1 < sortedByErr.length && sortedByErr[j + 1].err === sortedByErr[i].err) {
          j++;
        }
        const avgPosition = (i + j) / 2; // 0-indexed
        const percentile =
          sortedByErr.length === 1 ? 1 : 1 - avgPosition / (sortedByErr.length - 1);
        for (let k = i; k <= j; k++) {
          rankByEntryId.set(sortedByErr[k].entry.id, percentile);
        }
        i = j + 1;
      }
    }
    const season = String(new Date(q.createdAt).getUTCFullYear());

    // Pay winners + write skill scores + update entry rows.
    for (const x of errors) {
      const isWinner = x.err === bestErr;
      const payout = isWinner ? perWinnerMinor : 0;
      const percentile = rankByEntryId.get(x.entry.id) ?? 0;
      const pointsAwarded = Math.round(percentile * 1000); // 0..1000

      if (isWinner && payout > 0) {
        await postWalletTx(
          {
            userId: x.entry.userId,
            moneyKind: x.entry.moneyKind as MoneyKind,
            deltaMinor: payout,
            reason: "payout",
            refType: "question",
            refId: q.id,
            idempotencyKey: `payout:${q.id}:${x.entry.userId}`,
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

    // Record the commission (so wallet invariant covers operator revenue too —
    // we just don't have an "operator user" here; this is logged as audit only
    // for Phase 1. When Phase 2 lands we'll route it to an operator wallet).
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
      // Used by the post-commit notifier hook below.
      winnerUserIds: winners.map((w) => w.entry.userId),
      questionTitle: q.title,
    };
  }).then(async (result) => {
    // Fire notifications AFTER the transaction commits. Failures here must not
    // roll back the settlement. Each channel handles its own errors and the
    // notifier no-ops cleanly if Resend/FCM aren't configured.
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
