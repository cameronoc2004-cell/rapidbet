// =============================================================================
// Double-entry ledger.
//
// Money integrity rules (non-negotiable):
//  - balances are NEVER stored as a mutable field; they're derived from the
//    sum of postings against an account
//  - every transaction's postings must sum to zero (debits == credits)
//  - postings are append-only; corrections are new reversing transactions
//  - any state-changing operation locks the affected accounts FOR UPDATE so
//    two concurrent requests can't spend the same funds
//  - non-negative invariant on user_available / user_held / pool accounts is
//    asserted inside the locked transaction, after re-deriving the balance
//  - idempotency key on webhook-driven events; replays are no-ops
//
// Account kinds:
//   user:{id}:available:{kind}   spendable
//   user:{id}:held:{kind}        funds reserved (in-flight buy-in / withdraw)
//   pool:{questionId}:{kind}     escrow for one question
//   house:rake:{kind}            commission revenue
//   ext:{rail}:{kind}            external rail (trustly / genesis)
// =============================================================================

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { accounts, postings, transactions, type MoneyKind } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AccountKind =
  | "user_available"
  | "user_held"
  | "pool"
  | "house_rake"
  | "external_rail";

export type TransactionKind =
  | "deposit"
  | "buyin"
  | "lock"
  | "void_refund"
  | "settle_rake"
  | "settle_payout"
  | "withdraw_initiate"
  | "withdraw_confirm"
  | "withdraw_fail"
  | "signup_bonus"
  | "genesis"
  | "admin_adjust";

// User_available / user_held / pool may never go negative — that's where the
// non-negative invariant fires. external_rail and house_rake are allowed to
// hold any sign (they represent off-platform / cumulative-revenue concepts).
const CONSTRAINED_KINDS: AccountKind[] = ["user_available", "user_held", "pool"];

export interface AccountSpec {
  kind: AccountKind;
  userId?: number | null;
  questionId?: number | null;
  // Optional discriminator for rails (e.g. "trustly", "genesis"); only used
  // when kind === "external_rail".
  rail?: string;
  moneyKind: MoneyKind;
}

export interface PostingInput {
  accountId: number;
  amountMinor: number; // signed; positive = credit, negative = debit
}

export interface PostTransactionInput {
  kind: TransactionKind;
  postings: PostingInput[];
  idempotencyKey?: string;
  refType?: string;
  refId?: number;
  actorUserId?: number | null;
  payload?: Record<string, unknown>;
}

export class LedgerError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = "LedgerError";
  }
}

// ---------- account key + ensureAccount ----------

export function accountKey(spec: AccountSpec): string {
  switch (spec.kind) {
    case "user_available":
      if (spec.userId == null) throw new LedgerError("bad_spec", "user_available needs userId");
      return `user:${spec.userId}:available:${spec.moneyKind}`;
    case "user_held":
      if (spec.userId == null) throw new LedgerError("bad_spec", "user_held needs userId");
      return `user:${spec.userId}:held:${spec.moneyKind}`;
    case "pool":
      if (spec.questionId == null) throw new LedgerError("bad_spec", "pool needs questionId");
      return `pool:${spec.questionId}:${spec.moneyKind}`;
    case "house_rake":
      return `house:rake:${spec.moneyKind}`;
    case "external_rail":
      return `ext:${spec.rail ?? "trustly"}:${spec.moneyKind}`;
  }
}

// Get or create an account for the spec. Idempotent.
export async function ensureAccount(spec: AccountSpec, tx?: Tx) {
  const exec = tx ?? db;
  const key = accountKey(spec);

  const existing = await exec.select().from(accounts).where(eq(accounts.key, key)).limit(1);
  if (existing.length > 0) return existing[0];

  // Concurrent create race: insert with on-conflict-do-nothing semantics.
  // Postgres unique-violation on the key column is the race signal.
  try {
    const [created] = await exec
      .insert(accounts)
      .values({
        key,
        kind: spec.kind,
        userId: spec.userId ?? null,
        questionId: spec.questionId ?? null,
        moneyKind: spec.moneyKind,
      })
      .returning();
    return created;
  } catch {
    // Another writer beat us. Re-read.
    const [row] = await exec.select().from(accounts).where(eq(accounts.key, key)).limit(1);
    if (!row) throw new LedgerError("account_create_race", key);
    return row;
  }
}

// ---------- core postTransaction ----------

export async function postTransaction(
  input: PostTransactionInput,
  tx?: Tx,
): Promise<{ transactionId: number; idempotentHit: boolean }> {
  if (input.postings.length === 0) {
    throw new LedgerError("empty_transaction");
  }
  const sum = input.postings.reduce((s, p) => s + p.amountMinor, 0);
  if (sum !== 0) {
    throw new LedgerError(
      "not_balanced",
      `Postings must sum to 0; got ${sum} across ${input.postings.length} lines`,
    );
  }
  for (const p of input.postings) {
    if (!Number.isInteger(p.amountMinor)) {
      throw new LedgerError(
        "non_integer_amount",
        `amount_minor must be an integer; got ${p.amountMinor}`,
      );
    }
  }

  const run = async (t: Tx | typeof db) => {
    // Idempotency: if the same key already posted, short-circuit.
    if (input.idempotencyKey) {
      const prior = await t
        .select()
        .from(transactions)
        .where(eq(transactions.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (prior.length > 0) {
        return { transactionId: prior[0].id, idempotentHit: true };
      }
    }

    // Lock every affected account row so concurrent writers serialize.
    const affectedAccountIds = [...new Set(input.postings.map((p) => p.accountId))];
    const locked = await t
      .select()
      .from(accounts)
      .where(inArray(accounts.id, affectedAccountIds))
      .for("update");
    const byId = new Map(locked.map((a) => [a.id, a]));

    // Re-derive each constrained account's balance and confirm the new
    // postings won't push it negative.
    for (const accountId of affectedAccountIds) {
      const acct = byId.get(accountId);
      if (!acct) throw new LedgerError("account_not_found", String(accountId));
      if (!CONSTRAINED_KINDS.includes(acct.kind as AccountKind)) continue;

      const r = await t.execute(sql`
        SELECT COALESCE(SUM(amount_minor), 0)::bigint AS bal
        FROM postings
        WHERE account_id = ${accountId}
      `);
      // postgres-js returns rows; drizzle wraps as { rows: [...] }
      const rows = (r as unknown as { rows?: Array<{ bal: string | number }> }).rows
        ?? (r as unknown as Array<{ bal: string | number }>);
      const current = Number(rows?.[0]?.bal ?? 0);

      const delta = input.postings
        .filter((p) => p.accountId === accountId)
        .reduce((s, p) => s + p.amountMinor, 0);
      const next = current + delta;
      if (next < 0) {
        throw new LedgerError(
          "insufficient_funds",
          `Account ${acct.key}: balance ${current} + delta ${delta} = ${next} < 0`,
        );
      }
    }

    // Insert transaction and postings atomically (we're already inside a tx).
    const [txRow] = await t
      .insert(transactions)
      .values({
        kind: input.kind,
        idempotencyKey: input.idempotencyKey,
        refType: input.refType,
        refId: input.refId,
        payload: input.payload ?? null,
        actorUserId: input.actorUserId ?? null,
      })
      .returning();

    await t.insert(postings).values(
      input.postings.map((p) => ({
        transactionId: txRow.id,
        accountId: p.accountId,
        amountMinor: p.amountMinor,
      })),
    );

    return { transactionId: txRow.id, idempotentHit: false };
  };

  if (tx) return run(tx);
  return db.transaction(run);
}

// ---------- derived balance reads ----------

export async function getBalance(accountId: number, tx?: Tx): Promise<number> {
  const exec = tx ?? db;
  const r = await exec.execute(sql`
    SELECT COALESCE(SUM(amount_minor), 0)::bigint AS bal
    FROM postings
    WHERE account_id = ${accountId}
  `);
  const rows = (r as unknown as { rows?: Array<{ bal: string | number }> }).rows
    ?? (r as unknown as Array<{ bal: string | number }>);
  return Number(rows?.[0]?.bal ?? 0);
}

export async function getUserAvailable(
  userId: number,
  moneyKind: MoneyKind = "virtual",
  tx?: Tx,
): Promise<number> {
  const acct = await ensureAccount({ kind: "user_available", userId, moneyKind }, tx);
  return getBalance(acct.id, tx);
}

export async function getUserHeld(
  userId: number,
  moneyKind: MoneyKind = "virtual",
  tx?: Tx,
): Promise<number> {
  const acct = await ensureAccount({ kind: "user_held", userId, moneyKind }, tx);
  return getBalance(acct.id, tx);
}

export async function getPoolBalance(
  questionId: number,
  moneyKind: MoneyKind = "virtual",
  tx?: Tx,
): Promise<number> {
  const acct = await ensureAccount({ kind: "pool", questionId, moneyKind }, tx);
  return getBalance(acct.id, tx);
}

export async function getHouseRake(
  moneyKind: MoneyKind = "virtual",
  tx?: Tx,
): Promise<number> {
  const acct = await ensureAccount({ kind: "house_rake", moneyKind }, tx);
  return getBalance(acct.id, tx);
}

// ---------- reconciliation ----------

// The system-wide invariant: sum of all internal accounts (users + pools +
// house rake) must equal -1 * sum of all external rails. Equivalently:
// (user_available + user_held + pool + house_rake) + external_rail == 0.
// Drift implies a missing or corrupt posting somewhere.
export async function reconcile(
  moneyKind: MoneyKind,
  tx?: Tx,
): Promise<{ internalSum: number; externalSum: number; drift: number }> {
  const exec = tx ?? db;
  const r = await exec.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN a.kind IN ('user_available','user_held','pool','house_rake') THEN p.amount_minor ELSE 0 END), 0)::bigint AS internal_sum,
      COALESCE(SUM(CASE WHEN a.kind = 'external_rail' THEN p.amount_minor ELSE 0 END), 0)::bigint AS external_sum
    FROM postings p
    JOIN accounts a ON a.id = p.account_id
    WHERE a.money_kind = ${moneyKind}
  `);
  const rows =
    (r as unknown as { rows?: Array<{ internal_sum: string | number; external_sum: string | number }> }).rows
    ?? (r as unknown as Array<{ internal_sum: string | number; external_sum: string | number }>);
  const internalSum = Number(rows?.[0]?.internal_sum ?? 0);
  const externalSum = Number(rows?.[0]?.external_sum ?? 0);
  const drift = internalSum + externalSum;
  return { internalSum, externalSum, drift };
}

export async function assertReconciles(moneyKind: MoneyKind, tx?: Tx): Promise<void> {
  const r = await reconcile(moneyKind, tx);
  if (r.drift !== 0) {
    throw new LedgerError(
      "reconcile_drift",
      `${moneyKind}: internal ${r.internalSum} + external ${r.externalSum} = drift ${r.drift}`,
    );
  }
}
