import { NextResponse, type NextRequest } from "next/server";
import { Webhook } from "svix";
import { services } from "@/lib/services/config";
import { logAudit } from "@/db/audit";

// Resend signs webhooks with svix. Reject anything we can't verify.
// Doc: https://resend.com/docs/dashboard/webhooks/introduction
export async function POST(req: NextRequest) {
  if (!services.resend.webhookSecret) {
    // Allow during dev, but loudly log. In prod, set the secret.
    console.warn("[resend] webhook hit without RESEND_WEBHOOK_SECRET configured");
  }
  const body = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let event: { type?: string; data?: { email_id?: string; to?: string[] } };
  try {
    if (services.resend.webhookSecret) {
      const wh = new Webhook(services.resend.webhookSecret);
      event = wh.verify(body, headers) as typeof event;
    } else {
      event = JSON.parse(body);
    }
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // For now just audit-log every event. Phase 2: maintain a suppression list
  // for bounced / complained addresses so we don't keep sending to them.
  // TODO(prod): add suppressions table + check before send.
  await logAudit({
    action: `email.webhook.${event.type ?? "unknown"}`,
    payload: { vendor: "resend", emailId: event.data?.email_id, to: event.data?.to },
  });

  return NextResponse.json({ ok: true });
}
