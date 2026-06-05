import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { paymentOrders } from "@/db/schema";
import { depositConfirmed, withdrawFailed } from "@/lib/ledger-ops";
import { logAudit } from "@/db/audit";
import { REAL_MONEY_ENABLED } from "@/lib/config";
import { services } from "@/lib/services/config";

// Trustly NOTIFICATION webhook handler.
//
// REJECT unsigned or invalid signatures. ACK in the exact shape Trustly
// expects (a JSON-RPC response object). Settlement happens HERE, not on the
// initial Deposit/AccountPayout response — never trust the synchronous reply.
//
// Dedupe via payment_orders.vendor_order_id. Wallet credit/debit uses
// postWalletTx with the Trustly orderid as idempotency key so duplicate
// notifications collapse to a no-op.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // Parse JSON-RPC envelope.
  let envelope: {
    method?: string;
    params?: { UUID?: string; Data?: Record<string, unknown>; Signature?: string };
  };
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return rpcError(-32700, "Parse error");
  }
  const { method, params } = envelope;
  if (!method || !params?.UUID || !params.Data || !params.Signature) {
    return rpcError(-32600, "Invalid Request");
  }

  // Verify Trustly's signature.
  if (!services.trustly.trustlyPublicKeyPem) {
    console.error("[trustly] webhook hit without TRUSTLY_PUBLIC_KEY configured");
    return rpcError(-32603, "Server not configured");
  }
  const canonical = method + params.UUID + sortedJson(params.Data);
  const verified = crypto
    .createVerify("RSA-SHA1")
    .update(canonical)
    .verify(services.trustly.trustlyPublicKeyPem, params.Signature, "base64");
  if (!verified) {
    await logAudit({ action: "trustly.webhook.bad_signature", payload: envelope });
    return rpcError(-32600, "Invalid signature");
  }

  // From here, payload is trusted.
  const data = params.Data as {
    orderid?: string | number;
    amount?: string;
    enduserid?: string;
    notificationid?: string;
  };
  const vendorOrderId = data.orderid != null ? String(data.orderid) : null;
  if (!vendorOrderId) return rpcError(-32600, "missing orderid");

  // Lookup our order row.
  const [order] = await db
    .select()
    .from(paymentOrders)
    .where(eq(paymentOrders.vendorOrderId, vendorOrderId))
    .limit(1);
  if (!order) {
    await logAudit({
      action: "trustly.webhook.unknown_order",
      payload: { method, vendorOrderId },
    });
    return rpcAck(data.notificationid);
  }

  if (!REAL_MONEY_ENABLED) {
    // Should not happen — we never created an order in Phase 1 — but defense
    // in depth.
    return rpcAck(data.notificationid);
  }

  const amountMinor = Math.round(Number(data.amount ?? "0") * 100);

  // Lifecycle by method per Trustly docs (verify before prod).  // TODO(vendor)
  // Deposits: "credit" notification = funds arrived. "debit" on a deposit means refund.
  // Payouts: "debit" = payout sent. "credit" notification on payout = refund/returned.
  if (method === "credit" && order.kind === "deposit") {
    await db.transaction(async (tx) => {
      await depositConfirmed(
        {
          userId: order.userId,
          amountMinor,
          trustlyOrderId: vendorOrderId,
          moneyKind: "real",
        },
        tx,
      );
      await tx
        .update(paymentOrders)
        .set({ status: "confirmed", lastPayload: data, updatedAt: new Date() })
        .where(eq(paymentOrders.id, order.id));
    });
  } else if (method === "debit" && order.kind === "withdrawal") {
    // Withdrawal sent: marker only; the debit was applied at initiate. Just confirm.
    await db
      .update(paymentOrders)
      .set({ status: "confirmed", lastPayload: data, updatedAt: new Date() })
      .where(eq(paymentOrders.id, order.id));
  } else if (method === "credit" && order.kind === "withdrawal") {
    // Withdrawal failed/returned: reverse the original debit.
    await db.transaction(async (tx) => {
      await withdrawFailed(
        {
          userId: order.userId,
          amountMinor: order.amountMinor,
          trustlyOrderId: vendorOrderId,
          moneyKind: "real",
        },
        tx,
      );
      await tx
        .update(paymentOrders)
        .set({ status: "failed", lastPayload: data, updatedAt: new Date() })
        .where(eq(paymentOrders.id, order.id));
    });
  } else {
    // Unknown lifecycle event — log but ACK to avoid retry storms.
    await logAudit({
      action: "trustly.webhook.unhandled",
      payload: { method, vendorOrderId, data },
    });
  }

  return rpcAck(data.notificationid);
}

function rpcAck(notificationId?: string) {
  return NextResponse.json({
    result: { method: "1", data: { notificationid: notificationId ?? "", status: "OK" } },
    version: "1.1",
  });
}
function rpcError(code: number, message: string) {
  return NextResponse.json(
    { error: { code, message }, version: "1.1" },
    { status: 400 },
  );
}

function sortedJson(obj: Record<string, unknown>): string {
  const sortKeys = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = sortKeys((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(sortKeys(obj));
}
