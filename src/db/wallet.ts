// Thin compatibility shim over the new double-entry ledger
// (src/db/ledger.ts). New code should import from "@/db/ledger" directly.
// This file exists so existing readers (top-bar, /me, balance-pill, etc.)
// don't have to change wiring while we phase the old wallets/ledger_entries
// tables out.

import { getUserAvailable, LedgerError } from "./ledger";
import type { MoneyKind } from "./schema";

// Same shape as before: a wallet has a virtual + real balance. Both are
// derived from the new ledger.
export async function getWallet(
  userId: number,
): Promise<{ virtualMinor: number; realMinor: number }> {
  return {
    virtualMinor: await getUserAvailable(userId, "virtual"),
    realMinor: await getUserAvailable(userId, "real"),
  };
}

export async function getBalance(
  userId: number,
  moneyKind: MoneyKind,
): Promise<number> {
  return getUserAvailable(userId, moneyKind);
}

// Legacy export kept so existing catches still compile; new code should look
// at LedgerError.code === "insufficient_funds".
export class InsufficientFundsError extends Error {
  constructor(public readonly moneyKind: MoneyKind) {
    super(`Insufficient ${moneyKind} balance`);
    this.name = "InsufficientFundsError";
  }
}

// Translates LedgerError("insufficient_funds") → InsufficientFundsError so
// older callers see the same exception type.
export function asInsufficientFunds(e: unknown, moneyKind: MoneyKind): never {
  if (e instanceof LedgerError && e.code === "insufficient_funds") {
    throw new InsufficientFundsError(moneyKind);
  }
  throw e;
}
