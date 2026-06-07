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
// Didit /v3 KYC.
//
// Flow: createSession -> user completes the workflow (ID + liveness + face
// match) in Didit's hosted UI -> Didit fires a `status.updated` webhook with
// the decision. We persist the decision (NOT the documents) and the vendor
// session id.
//
// Sandbox vs production is determined by which API key you use; the host is
// the same (verification.didit.me/v3). The workflow_id, configured at
// business.didit.me, controls which steps run.
//
// FREE TIER: 500 full KYC bundles / month. Design to consume ONE verification
// per user. Real-money entry is gated on getStatus(user).status === "verified".
// =============================================================================

const SESSION_URL = "https://verification.didit.me/v3/session/";

class DiditKyc implements KycProvider {
  async createSession({
    userId,
    email,
  }: {
    userId: number;
    email: string;
  }): Promise<KycCreateSessionResult> {
    if (!isDiditConfigured()) {
      throw new Error("Didit not configured. Set DIDIT_API_KEY and DIDIT_WORKFLOW_ID.");
    }
    // Sandbox sessions are allowed in Phase 1 so the onboarding flow is
    // buildable; real-money entry/withdrawal still requires REAL_MONEY_ENABLED.
    void REAL_MONEY_ENABLED;

    const res = await fetch(SESSION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": services.didit.apiKey,
      },
      body: JSON.stringify({
        workflow_id: services.didit.workflowId,
        vendor_data: String(userId),
        callback: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/me`
          : undefined,
        contact_details: email ? { email } : undefined,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Didit create session failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as {
      session_id?: string;
      url?: string;
    };
    const sessionId = data.session_id ?? "";
    const hostedUrl = data.url ?? "";
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
