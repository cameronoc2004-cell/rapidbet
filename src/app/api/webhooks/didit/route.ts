import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { kycRecords } from "@/db/schema";
import { logAudit } from "@/db/audit";
import { services } from "@/lib/services/config";

// Didit webhook: HMAC-SHA256 over the raw body using the shared secret. Reject
// anything we cannot verify — a spoofed "approved" event would bypass KYC.
//
// Header name varies by Didit version; check the dashboard webhook config.
// TODO(vendor): confirm exact header + signing algorithm against current docs.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature =
    req.headers.get("x-didit-signature") ??
    req.headers.get("didit-signature") ??
    req.headers.get("x-signature") ??
    "";

  if (!services.didit.webhookSecret) {
    console.error("[didit] webhook hit without DIDIT_WEBHOOK_SECRET configured");
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const expected = crypto
    .createHmac("sha256", services.didit.webhookSecret)
    .update(raw)
    .digest("hex");
  if (!signature || !timingSafeEqualHex(expected, signature)) {
    await logAudit({ action: "didit.webhook.bad_signature" });
    return NextResponse.json({ error: "bad_signature" }, { status: 401 });
  }

  let event: {
    session_id?: string;
    status?: string;          // approved / declined / pending / expired
    vendor_data?: string;     // we passed userId here at session create
    age_eligible?: boolean;
    jurisdiction?: string;
    expires_at?: string;
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sessionId = event.session_id ?? "";
  if (!sessionId) return NextResponse.json({ error: "missing_session_id" }, { status: 400 });

  // Find the pending record by vendor_ref.
  const [existing] = await db
    .select()
    .from(kycRecords)
    .where(eq(kycRecords.vendorRef, sessionId))
    .limit(1);
  if (!existing) {
    await logAudit({
      action: "didit.webhook.unknown_session",
      payload: { sessionId },
    });
    return NextResponse.json({ ok: true });
  }

  // Normalize Didit's status into our enum.
  const decision: "approved" | "declined" | "pending" | "expired" =
    event.status === "Approved" || event.status === "approved"
      ? "approved"
      : event.status === "Declined" || event.status === "declined"
      ? "declined"
      : event.status === "Expired"
      ? "expired"
      : "pending";

  // Map our normalized decision into the schema enum (uses "rejected" not "declined").
  const persisted: "verified" | "pending" | "rejected" | "expired" =
    decision === "approved" ? "verified"
    : decision === "declined" ? "rejected"
    : decision;

  await db
    .update(kycRecords)
    .set({
      status: persisted,
      verifiedAt: decision === "approved" ? new Date() : null,
      expiresAt: event.expires_at ? new Date(event.expires_at) : null,
      // Store ONLY decision + derived fields — never raw documents.
      payload: {
        ageEligible: event.age_eligible ?? null,
        jurisdiction: event.jurisdiction ?? null,
        decision,
      },
    })
    .where(eq(kycRecords.id, existing.id));

  await logAudit({
    actorUserId: existing.userId,
    action: `kyc.${decision}`,
    refType: "kyc_record",
    refId: existing.id,
    payload: { sessionId, ageEligible: event.age_eligible, jurisdiction: event.jurisdiction },
  });

  return NextResponse.json({ ok: true });
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
