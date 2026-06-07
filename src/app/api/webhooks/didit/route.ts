import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { kycRecords } from "@/db/schema";
import { logAudit } from "@/db/audit";
import { services } from "@/lib/services/config";

// Didit webhook handler.
//
// Signature: Didit sends three HMAC-SHA256 variants over the request — we
// verify X-Signature (raw bytes), the most reliable in Next.js where we can
// read the unparsed body. X-Timestamp must be within 5 min to block replays.
// Reject anything we cannot verify — a spoofed "approved" event would bypass
// KYC and let an unverified user enter real-money contests.
const TIMESTAMP_TOLERANCE_SECONDS = 300;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("x-signature") ?? "";
  const timestamp = req.headers.get("x-timestamp") ?? "";

  if (!services.didit.webhookSecret) {
    console.error("[didit] webhook hit without DIDIT_WEBHOOK_SECRET configured");
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  // Replay protection: reject anything older than 5 min.
  const tsSec = Number(timestamp);
  if (!Number.isFinite(tsSec) || Math.abs(Date.now() / 1000 - tsSec) > TIMESTAMP_TOLERANCE_SECONDS) {
    await logAudit({ action: "didit.webhook.stale_timestamp", payload: { timestamp } });
    return NextResponse.json({ error: "stale_timestamp" }, { status: 401 });
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
    status?: string;            // Approved / Declined / In Review / In Progress / Not Started / Abandoned / Expired / KYC Expired / Resubmitted
    webhook_type?: string;      // "status.updated" etc.
    vendor_data?: string;       // we passed userId here at session create
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
  // "In Review" is a human-review hold — not approved yet, but not declined.
  // "Abandoned" / "Expired" / "KYC Expired" mean the user has to start over.
  const s = (event.status ?? "").toLowerCase();
  const decision: "approved" | "declined" | "pending" | "expired" =
    s === "approved" ? "approved"
    : s === "declined" ? "declined"
    : s === "expired" || s === "kyc expired" || s === "abandoned" ? "expired"
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
