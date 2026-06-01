// =============================================================================
// PaymentProvider — deposits + withdrawals for REAL-MONEY mode only.
//
// Phase 1: StubPaymentProvider throws on every call. The product is free-to-play;
// there is no deposit, no withdrawal. The interface exists so Phase 2 swap-in is
// a one-line change.
//
// IMPORTANT: Stripe / PayPal / Square are NOT permitted for entry fees or
// payouts on a real-money gaming product — their TOS prohibit it and they will
// freeze funds. Vendor candidates: Worldpay, Nuvei, OPM/Trustly for ACH,
// PayNearMe for cash. TODO(vendor)
// =============================================================================

import { REAL_MONEY_ENABLED } from "@/lib/config";

export interface DepositInput {
  userId: number;
  amountMinor: number;
  // In real implementation: tokenized PM, billing zip, geo-check id, etc.
  idempotencyKey: string;
}

export interface WithdrawalInput {
  userId: number;
  amountMinor: number;
  idempotencyKey: string;
}

export interface PaymentResult {
  vendor: string;
  vendorRef: string;
  status: "succeeded" | "pending" | "failed";
}

export interface PaymentProvider {
  deposit(input: DepositInput): Promise<PaymentResult>;
  withdraw(input: WithdrawalInput): Promise<PaymentResult>;
}

class StubPaymentProvider implements PaymentProvider {
  async deposit(_: DepositInput): Promise<PaymentResult> {
    if (!REAL_MONEY_ENABLED) {
      throw new Error(
        "PaymentProvider.deposit blocked: REAL_MONEY_ENABLED is false. " +
          "Phase 1 is free-to-play.",
      );
    }
    throw new Error("No payment vendor wired. TODO(vendor).");
  }

  async withdraw(_: WithdrawalInput): Promise<PaymentResult> {
    if (!REAL_MONEY_ENABLED) {
      throw new Error(
        "PaymentProvider.withdraw blocked: REAL_MONEY_ENABLED is false. " +
          "Phase 1 is free-to-play.",
      );
    }
    throw new Error("No payment vendor wired. TODO(vendor).");
  }
}

export const paymentProvider: PaymentProvider = new StubPaymentProvider();
