import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { kycRecords } from "@/db/schema";
import { REAL_MONEY_ENABLED } from "@/lib/config";
import { isDiditConfigured, services } from "../config";
import type {
  KycCreateSessionResult,
  KycProvider,
  KycSummary,
} from "../types";

// =============================================================================
// Didit /v3 KYC.  Sandbox-first.
//
// Flow: createSession -> user completes ID + liveness + face match in Didit's
// hosted UI -> Didit fires a webhook with the decision. We persist the
// decision (NOT the documents) and the vendor session id.
//
// FREE TIER: 500 full KYC bundles / month. Design to consume ONE verification
// per user. Real-money entry is gated on getStatus(user).status === "approved".
// =============================================================================

const ENDPOINTS: Record<"sandbox" | "production", string> = {
  sandbox: "https://verification.staging.didit.me/v3",
  production: "https://verification.didit.me/v3",
};

class DiditKyc implements KycProvider {
  async createSession({
    userId,
    email,
  }: {
    userId: number;
    email: string;
  }): Promise<KycCreateSessionResult> {
    if (!REAL_MONEY_ENABLED) {
      // We allow stub sessions in sandbox so the UX is buildable; but real
      // money still can't flow without the master flag.
    }
    if (!isDiditConfigured()) {
      throw new Error("Didit not configured. Set DIDIT_API_KEY.");
    }

    const url = `${ENDPOINTS[services.didit.env]}/session/`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": services.didit.apiKey,
      },
      body: JSON.stringify({
        // TODO(vendor): confirm field names against current Didit /v3 docs;
        // shape below is illustrative.
        vendor_data: String(userId),
        callback: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/me`
          : "",
        features: ["OCR", "FACE_MATCH", "LIVENESS"],
        email,
      }),
    });
    const data = (await res.json()) as {
      session_id?: string;
      url?: string;
      session_url?: string;
    };
    const sessionId = data.session_id ?? "";
    const hostedUrl = data.url ?? data.session_url ?? "";
    if (!sessionId || !hostedUrl) {
      throw new Error(`Didit create session: unexpected response shape`);
    }
    // Persist a "pending" record so getStatus can return it before the webhook fires.
    await db.insert(kycRecords).values({
      userId,
      status: "pending",
      vendor: "didit",
      vendorRef: sessionId,
    });
    return { vendor: "didit", vendorRef: sessionId, hostedUrl };
  }

  async getStatus(userId: number): Promise<KycSummary> {
    const rows = await db
      .select()
      .from(kycRecords)
      .where(eq(kycRecords.userId, userId))
      .orderBy(desc(kycRecords.createdAt))
      .limit(1);
    const r = rows[0];
    if (!r) {
      return { status: "none", ageEligible: null, jurisdiction: null, verifiedAt: null };
    }
    const payload = (r.payload ?? {}) as { ageEligible?: boolean; jurisdiction?: string };
    return {
      status: r.status as KycSummary["status"],
      ageEligible: payload.ageEligible ?? null,
      jurisdiction: payload.jurisdiction ?? null,
      verifiedAt: r.verifiedAt ?? null,
    };
  }
}

export const diditKyc: KycProvider = new DiditKyc();
