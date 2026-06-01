import { eq, and } from "drizzle-orm";
import { db } from "./client";
import { balances, ledgerEntries, type Currency } from "./schema";

export type LedgerReason =
  | "signup_bonus"
  | "entry_buyin"
  | "entry_refund"
  | "payout"
  | "admin_adjust";

export interface PostTxInput {
  userId: number;
  currency: Currency;
  delta: number;
  reason: LedgerReason;
  refType?: string;
  refId?: number;
}

export class InsufficientFundsError extends Error {
  constructor(public readonly currency: Currency) {
    super(`Insufficient ${currency} balance`);
  }
}

// Drizzle transaction type — generic over the schema we use.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// All balance changes go through this function. The balance row + ledger row
// are written inside a single Postgres transaction; nothing else may mutate
// balances. This is the foundation of sweepstakes auditability.
//
// Accepts an optional `tx` so callers can compose multiple postTransaction
// calls (and other DB writes) into one atomic unit.
export async function postTransaction(
  input: PostTxInput,
  tx?: Tx,
): Promise<{ balanceAfter: number }> {
  const exec = async (t: Tx | typeof db) => {
    const { userId, currency, delta, reason, refType, refId } = input;

    const existing = await t
      .select()
      .from(balances)
      .where(and(eq(balances.userId, userId), eq(balances.currency, currency)))
      .for("update")
      .limit(1);

    const current = existing[0]?.amount ?? 0;
    const next = current + delta;

    if (next < 0) {
      throw new InsufficientFundsError(currency);
    }

    if (existing.length > 0) {
      await t
        .update(balances)
        .set({ amount: next })
        .where(and(eq(balances.userId, userId), eq(balances.currency, currency)));
    } else {
      await t.insert(balances).values({ userId, currency, amount: next });
    }

    await t.insert(ledgerEntries).values({
      userId,
      currency,
      delta,
      balanceAfter: next,
      reason,
      refType,
      refId,
    });

    return { balanceAfter: next };
  };

  if (tx) return exec(tx);
  return db.transaction(exec);
}

export async function getBalance(
  userId: number,
  currency: Currency,
): Promise<number> {
  const rows = await db
    .select()
    .from(balances)
    .where(and(eq(balances.userId, userId), eq(balances.currency, currency)))
    .limit(1);
  return rows[0]?.amount ?? 0;
}

export async function getAllBalances(
  userId: number,
): Promise<Record<Currency, number>> {
  const rows = await db.select().from(balances).where(eq(balances.userId, userId));
  const out: Record<Currency, number> = { GC: 0, SC: 0 };
  for (const r of rows) out[r.currency as Currency] = r.amount;
  return out;
}
