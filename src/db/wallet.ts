// =============================================================================
// Wallet + ledger helpers.
//
// Every cent that moves does so through postWalletTx. It updates the wallet row
// and inserts an immutable ledger_entries row in the same transaction. Callers
// can pass an existing `tx` to compose multiple wallet writes atomically with
// other DB writes (entry insertion, settlement etc.).
//
// Idempotency: pass an idempotencyKey to make a logical event safely retryable.
// Re-posting the same key is a no-op that returns the prior balance.
//
// Real-money invariant: real money may move only when REAL_MONEY_ENABLED is on.
// =============================================================================

import { and, eq } from "drizzle-orm";
import { db } from "./client";
import { ledgerEntries, wallets, type MoneyKind } from "./schema";
import { REAL_MONEY_ENABLED } from "@/lib/config";

export type LedgerReason =
  | "signup_bonus"
  | "deposit"
  | "withdrawal"
  | "entry_fee"
  | "entry_refund"
  | "payout"
  | "commission"
  | "admin_adjust";

export interface PostTxInput {
  userId: number;
  moneyKind: MoneyKind;
  deltaMinor: number;
  reason: LedgerReason;
  refType?: string;
  refId?: number;
  idempotencyKey?: string;
}

export class InsufficientFundsError extends Error {
  constructor(public readonly moneyKind: MoneyKind) {
    super(`Insufficient ${moneyKind} balance`);
  }
}

export class RealMoneyDisabledError extends Error {
  constructor() {
    super("Real-money flow attempted while REAL_MONEY_ENABLED=false");
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function postWalletTx(
  input: PostTxInput,
  tx?: Tx,
): Promise<{ balanceAfterMinor: number; idempotentHit: boolean }> {
  if (input.moneyKind === "real" && !REAL_MONEY_ENABLED) {
    throw new RealMoneyDisabledError();
  }
  if (!Number.isInteger(input.deltaMinor)) {
    throw new Error(`deltaMinor must be an integer (minor units), got ${input.deltaMinor}`);
  }

  const run = async (t: Tx | typeof db) => {
    // Idempotency: short-circuit if this key already posted.
    if (input.idempotencyKey) {
      const prior = await t
        .select()
        .from(ledgerEntries)
        .where(eq(ledgerEntries.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (prior.length > 0) {
        return { balanceAfterMinor: prior[0].balanceAfterMinor, idempotentHit: true };
      }
    }

    // Lock the wallet row for this transaction.
    const existing = await t
      .select()
      .from(wallets)
      .where(eq(wallets.userId, input.userId))
      .for("update")
      .limit(1);

    const wallet =
      existing[0] ??
      (await t
        .insert(wallets)
        .values({ userId: input.userId })
        .returning()
        .then((r) => r[0]));

    const currentMinor =
      input.moneyKind === "virtual"
        ? wallet.virtualBalanceMinor
        : wallet.realBalanceMinor;
    const nextMinor = currentMinor + input.deltaMinor;
    if (nextMinor < 0) throw new InsufficientFundsError(input.moneyKind);

    await t
      .update(wallets)
      .set(
        input.moneyKind === "virtual"
          ? { virtualBalanceMinor: nextMinor, updatedAt: new Date() }
          : { realBalanceMinor: nextMinor, updatedAt: new Date() },
      )
      .where(eq(wallets.userId, input.userId));

    await t.insert(ledgerEntries).values({
      userId: input.userId,
      moneyKind: input.moneyKind,
      deltaMinor: input.deltaMinor,
      balanceAfterMinor: nextMinor,
      reason: input.reason,
      refType: input.refType,
      refId: input.refId,
      idempotencyKey: input.idempotencyKey,
    });

    return { balanceAfterMinor: nextMinor, idempotentHit: false };
  };

  if (tx) return run(tx);
  return db.transaction(run);
}

export async function getWallet(userId: number): Promise<{ virtualMinor: number; realMinor: number }> {
  const rows = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  if (rows.length === 0) return { virtualMinor: 0, realMinor: 0 };
  return {
    virtualMinor: rows[0].virtualBalanceMinor,
    realMinor: rows[0].realBalanceMinor,
  };
}

// Verifies wallet vs ledger invariant. Used in tests and a periodic audit job.
export async function assertLedgerInvariant(userId: number): Promise<void> {
  const wallet = await getWallet(userId);
  const allLedger = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, userId));
  let virtualSum = 0;
  let realSum = 0;
  for (const e of allLedger) {
    if (e.moneyKind === "virtual") virtualSum += e.deltaMinor;
    else realSum += e.deltaMinor;
  }
  if (virtualSum !== wallet.virtualMinor || realSum !== wallet.realMinor) {
    throw new Error(
      `Ledger invariant violated for user ${userId}: wallet={v:${wallet.virtualMinor},r:${wallet.realMinor}} ledger={v:${virtualSum},r:${realSum}}`,
    );
  }
}
