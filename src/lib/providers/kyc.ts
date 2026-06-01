// =============================================================================
// KycProvider — identity + age verification before any REAL-MONEY entry or
// withdrawal.
//
// Phase 1: StubKycProvider returns "none" (i.e. unverified). Real-money entry
// points must check kyc status === "verified" AND age >= MIN_AGE_YEARS before
// allowing the call.
// Phase 2: Persona / Jumio / Veriff webhook writes to kyc_records.
// TODO(vendor): pick vendor + wire webhook + persist signed proof.
// =============================================================================

import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { kycRecords } from "@/db/schema";

export type KycStatus = "none" | "pending" | "verified" | "rejected" | "expired";

export interface KycSummary {
  status: KycStatus;
  verifiedAt: Date | null;
  expiresAt: Date | null;
}

export interface KycProvider {
  status(userId: number): Promise<KycSummary>;
}

class StubKycProvider implements KycProvider {
  async status(userId: number): Promise<KycSummary> {
    const rows = await db
      .select()
      .from(kycRecords)
      .where(eq(kycRecords.userId, userId))
      .orderBy(desc(kycRecords.createdAt))
      .limit(1);
    const r = rows[0];
    return {
      status: (r?.status as KycStatus) ?? "none",
      verifiedAt: r?.verifiedAt ?? null,
      expiresAt: r?.expiresAt ?? null,
    };
  }
}

export const kycProvider: KycProvider = new StubKycProvider();
