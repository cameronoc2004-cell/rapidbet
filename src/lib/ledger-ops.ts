// =============================================================================
// Lifecycle operations on the double-entry ledger.
//
// Every helper here is a thin wrapper around postTransaction() that knows
// which accounts to touch for a given business event. App code should only
// ever call these — never postTransaction() directly with hand-rolled postings.
// =============================================================================

import { db } from "@/db/client";
import {
  ensureAccount,
  postTransaction,
  type TransactionKind,
} from "@/db/ledger";
import type { MoneyKind } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

interface BaseInput {
  amountMinor: number;
  moneyKind?: MoneyKind;
  actorUserId?: number | null;
}

// ---------- 1. Deposit confirmed (Trustly webhook) ----------
export async function depositConfirmed(
  input: BaseInput & { userId: number; trustlyOrderId: string },
  tx?: Tx,
) {
  const moneyKind: MoneyKind = input.moneyKind ?? "real";
  const run = async (t: Tx) => {
    const ext = await ensureAccount(
      { kind: "external_rail", rail: "trustly", moneyKind },
      t,
    );
    const avail = await ensureAccount(
      { kind: "user_available", userId: input.userId, moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: "deposit",
        idempotencyKey: `trustly:deposit:${input.trustlyOrderId}`,
        refType: "trustly_order",
        actorUserId: input.actorUserId ?? input.userId,
        payload: {
          trustlyOrderId: input.trustlyOrderId,
          amountMinor: input.amountMinor,
        },
        postings: [
          { accountId: ext.id, amountMinor: -input.amountMinor },
          { accountId: avail.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

// ---------- 2a. Buy in (entry submitted) ----------
// available -> held. Held funds aren't spendable; they live in a separate
// account so withdraw / new buy-in calls can't double-spend the same dollar.
export async function buyIn(
  input: BaseInput & { userId: number; questionId: number; entryId: number },
  tx?: Tx,
) {
  const moneyKind: MoneyKind = input.moneyKind ?? "virtual";
  const run = async (t: Tx) => {
    const avail = await ensureAccount(
      { kind: "user_available", userId: input.userId, moneyKind },
      t,
    );
    const held = await ensureAccount(
      { kind: "user_held", userId: input.userId, moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: "buyin",
        idempotencyKey: `entry:buyin:${input.entryId}`,
        refType: "entry",
        refId: input.entryId,
        actorUserId: input.actorUserId ?? input.userId,
        payload: {
          questionId: input.questionId,
          entryId: input.entryId,
          amountMinor: input.amountMinor,
        },
        postings: [
          { accountId: avail.id, amountMinor: -input.amountMinor },
          { accountId: held.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

// ---------- 2b. Lock entry (entries final at locksAt) ----------
// held -> pool. After this the money lives in the question's escrow and
// can only leave via settlement or void.
export async function lockEntry(
  input: BaseInput & { userId: number; questionId: number; entryId: number },
  tx?: Tx,
) {
  const moneyKind: MoneyKind = input.moneyKind ?? "virtual";
  const run = async (t: Tx) => {
    const held = await ensureAccount(
      { kind: "user_held", userId: input.userId, moneyKind },
      t,
    );
    const pool = await ensureAccount(
      { kind: "pool", questionId: input.questionId, moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: "lock",
        idempotencyKey: `entry:lock:${input.entryId}`,
        refType: "entry",
        refId: input.entryId,
        actorUserId: input.actorUserId ?? input.userId,
        payload: { questionId: input.questionId, entryId: input.entryId },
        postings: [
          { accountId: held.id, amountMinor: -input.amountMinor },
          { accountId: pool.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

// ---------- 3. Void refund ----------
// Source can be held (pre-lock) or pool (post-lock). Caller picks. We expose
// two variants to keep the lifecycle explicit.
export async function voidRefundFromHeld(
  input: BaseInput & { userId: number; questionId: number; entryId: number },
  tx?: Tx,
) {
  const moneyKind: MoneyKind = input.moneyKind ?? "virtual";
  const run = async (t: Tx) => {
    const held = await ensureAccount(
      { kind: "user_held", userId: input.userId, moneyKind },
      t,
    );
    const avail = await ensureAccount(
      { kind: "user_available", userId: input.userId, moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: "void_refund",
        idempotencyKey: `entry:void_refund:${input.entryId}`,
        refType: "entry",
        refId: input.entryId,
        actorUserId: input.actorUserId ?? null,
        payload: {
          questionId: input.questionId,
          entryId: input.entryId,
          source: "held",
        },
        postings: [
          { accountId: held.id, amountMinor: -input.amountMinor },
          { accountId: avail.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

export async function voidRefundFromPool(
  input: BaseInput & { userId: number; questionId: number; entryId: number },
  tx?: Tx,
) {
  const moneyKind: MoneyKind = input.moneyKind ?? "virtual";
  const run = async (t: Tx) => {
    const pool = await ensureAccount(
      { kind: "pool", questionId: input.questionId, moneyKind },
      t,
    );
    const avail = await ensureAccount(
      { kind: "user_available", userId: input.userId, moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: "void_refund",
        idempotencyKey: `entry:void_refund:${input.entryId}`,
        refType: "entry",
        refId: input.entryId,
        actorUserId: input.actorUserId ?? null,
        payload: {
          questionId: input.questionId,
          entryId: input.entryId,
          source: "pool",
        },
        postings: [
          { accountId: pool.id, amountMinor: -input.amountMinor },
          { accountId: avail.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

// ---------- 4a. Settlement: rake ----------
export async function settleRake(
  input: BaseInput & { questionId: number },
  tx?: Tx,
) {
  if (input.amountMinor === 0) return null;
  const moneyKind: MoneyKind = input.moneyKind ?? "virtual";
  const run = async (t: Tx) => {
    const pool = await ensureAccount(
      { kind: "pool", questionId: input.questionId, moneyKind },
      t,
    );
    const rake = await ensureAccount({ kind: "house_rake", moneyKind }, t);
    return postTransaction(
      {
        kind: "settle_rake",
        idempotencyKey: `question:rake:${input.questionId}`,
        refType: "question",
        refId: input.questionId,
        actorUserId: input.actorUserId ?? null,
        payload: { questionId: input.questionId, amountMinor: input.amountMinor },
        postings: [
          { accountId: pool.id, amountMinor: -input.amountMinor },
          { accountId: rake.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

// ---------- 4b. Settlement: payout to one winner ----------
export async function settlePayout(
  input: BaseInput & { userId: number; questionId: number; entryId: number },
  tx?: Tx,
) {
  if (input.amountMinor === 0) return null;
  const moneyKind: MoneyKind = input.moneyKind ?? "virtual";
  const run = async (t: Tx) => {
    const pool = await ensureAccount(
      { kind: "pool", questionId: input.questionId, moneyKind },
      t,
    );
    const winnerAvail = await ensureAccount(
      { kind: "user_available", userId: input.userId, moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: "settle_payout",
        idempotencyKey: `entry:payout:${input.entryId}`,
        refType: "entry",
        refId: input.entryId,
        actorUserId: input.actorUserId ?? null,
        payload: {
          questionId: input.questionId,
          entryId: input.entryId,
          amountMinor: input.amountMinor,
        },
        postings: [
          { accountId: pool.id, amountMinor: -input.amountMinor },
          { accountId: winnerAvail.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

// ---------- 5a. Withdraw initiate ----------
export async function withdrawInitiate(
  input: BaseInput & { userId: number; trustlyOrderId: string },
  tx?: Tx,
) {
  const moneyKind: MoneyKind = input.moneyKind ?? "real";
  const run = async (t: Tx) => {
    const avail = await ensureAccount(
      { kind: "user_available", userId: input.userId, moneyKind },
      t,
    );
    const held = await ensureAccount(
      { kind: "user_held", userId: input.userId, moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: "withdraw_initiate",
        idempotencyKey: `trustly:withdraw_init:${input.trustlyOrderId}`,
        refType: "trustly_order",
        actorUserId: input.actorUserId ?? input.userId,
        payload: {
          trustlyOrderId: input.trustlyOrderId,
          amountMinor: input.amountMinor,
        },
        postings: [
          { accountId: avail.id, amountMinor: -input.amountMinor },
          { accountId: held.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

// ---------- 5b. Withdraw confirmed ----------
export async function withdrawConfirmed(
  input: BaseInput & { userId: number; trustlyOrderId: string },
  tx?: Tx,
) {
  const moneyKind: MoneyKind = input.moneyKind ?? "real";
  const run = async (t: Tx) => {
    const held = await ensureAccount(
      { kind: "user_held", userId: input.userId, moneyKind },
      t,
    );
    const ext = await ensureAccount(
      { kind: "external_rail", rail: "trustly", moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: "withdraw_confirm",
        idempotencyKey: `trustly:withdraw_confirm:${input.trustlyOrderId}`,
        refType: "trustly_order",
        actorUserId: input.actorUserId ?? input.userId,
        payload: {
          trustlyOrderId: input.trustlyOrderId,
          amountMinor: input.amountMinor,
        },
        postings: [
          { accountId: held.id, amountMinor: -input.amountMinor },
          { accountId: ext.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

// ---------- 5c. Withdraw failed ----------
export async function withdrawFailed(
  input: BaseInput & { userId: number; trustlyOrderId: string },
  tx?: Tx,
) {
  const moneyKind: MoneyKind = input.moneyKind ?? "real";
  const run = async (t: Tx) => {
    const held = await ensureAccount(
      { kind: "user_held", userId: input.userId, moneyKind },
      t,
    );
    const avail = await ensureAccount(
      { kind: "user_available", userId: input.userId, moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: "withdraw_fail",
        idempotencyKey: `trustly:withdraw_fail:${input.trustlyOrderId}`,
        refType: "trustly_order",
        actorUserId: input.actorUserId ?? input.userId,
        payload: {
          trustlyOrderId: input.trustlyOrderId,
          amountMinor: input.amountMinor,
        },
        postings: [
          { accountId: held.id, amountMinor: -input.amountMinor },
          { accountId: avail.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}

// ---------- Genesis credit (signup bonus + balance migration) ----------
// Treats free-play seed money as inflow from a synthetic external rail
// ("genesis") so the reconcile invariant still holds for virtual money.
export async function genesisCredit(
  input: BaseInput & { userId: number; reason: TransactionKind; idempotencyKey?: string },
  tx?: Tx,
) {
  const moneyKind: MoneyKind = input.moneyKind ?? "virtual";
  const run = async (t: Tx) => {
    const ext = await ensureAccount(
      { kind: "external_rail", rail: "genesis", moneyKind },
      t,
    );
    const avail = await ensureAccount(
      { kind: "user_available", userId: input.userId, moneyKind },
      t,
    );
    return postTransaction(
      {
        kind: input.reason,
        idempotencyKey: input.idempotencyKey ?? `${input.reason}:${input.userId}`,
        refType: "profile",
        refId: input.userId,
        actorUserId: input.actorUserId ?? input.userId,
        payload: { amountMinor: input.amountMinor },
        postings: [
          { accountId: ext.id, amountMinor: -input.amountMinor },
          { accountId: avail.id, amountMinor: input.amountMinor },
        ],
      },
      t,
    );
  };
  return tx ? run(tx) : db.transaction(run);
}
