import crypto from "node:crypto";
import { REAL_MONEY_ENABLED } from "@/lib/config";
import { isTrustlyConfigured, services } from "../config";
import type {
  DepositInitiateResult,
  PaymentProvider,
  WithdrawalInitiateResult,
} from "../types";

// =============================================================================
// Trustly JSON-RPC 2.0 client.  Sandbox-first.
//
// Outgoing: every request body has a `Signature` over the canonical
// (alphabetically-sorted) request data, signed RSA-SHA1 with our merchant
// private key, base64-encoded.
//
// Inbound webhook signatures are verified in app/api/webhooks/trustly/route.ts
// using Trustly's public key. Replays are deduped via payment_orders.vendor_order_id.
//
// THIS CLIENT THROWS unless REAL_MONEY_ENABLED is true AND Trustly creds are
// configured. The interface exists in Phase 1 so the wiring is testable; no
// real-money request can leave the box without the master gate.
// =============================================================================

const ENDPOINTS: Record<"sandbox" | "production", string> = {
  sandbox: "https://test.trustly.com/api/1",
  production: "https://api.trustly.com/api/1",
};

class TrustlyProvider implements PaymentProvider {
  private async call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    if (!REAL_MONEY_ENABLED) {
      throw new Error(
        "Trustly call blocked: REAL_MONEY_ENABLED is false (Phase 1 free-to-play).",
      );
    }
    if (!isTrustlyConfigured()) {
      throw new Error("Trustly not configured. Set TRUSTLY_USERNAME, TRUSTLY_PASSWORD, TRUSTLY_PRIVATE_KEY.");
    }

    const url = ENDPOINTS[services.trustly.env];
    const uuid = crypto.randomUUID();

    // Canonicalize: alphabetical keys, then JSON-serialize. Trustly's exact
    // canonicalization rule is "Method+UUID+JSON of Data sorted". Verify in
    // their current docs before going live. // TODO(vendor)
    const data = { ...params, Username: services.trustly.username, Password: services.trustly.password };
    const canonical = method + uuid + sortedJson(data);
    const sig = crypto
      .createSign("RSA-SHA1")
      .update(canonical)
      .sign(services.trustly.privateKeyPem, "base64");

    const body = {
      method,
      params: { UUID: uuid, Data: data, Signature: sig },
      version: "1.1",
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { result?: { data?: T }; error?: { message?: string } };
    if (json.error || !json.result?.data) {
      throw new Error(`Trustly ${method} failed: ${json.error?.message ?? "unknown"}`);
    }
    return json.result.data;
  }

  async deposit({
    userId,
    amountMinor,
  }: {
    userId: number;
    amountMinor: number;
  }): Promise<DepositInitiateResult> {
    // Trustly's Deposit method returns { url, orderid }
    const data = await this.call<{ url: string; orderid: string | number }>("Deposit", {
      EndUserID: String(userId),
      MessageID: crypto.randomUUID(),
      NotificationURL: services.trustly.notificationUrl,
      Amount: (amountMinor / 100).toFixed(2),
      Currency: "USD",
      Locale: "en_US",
      Country: "US",
      // TODO(vendor): populate identity attributes per Trustly schema.
    });
    return {
      vendor: "trustly",
      vendorOrderId: String(data.orderid),
      hostedCheckoutUrl: data.url,
    };
  }

  async withdraw({
    userId,
    amountMinor,
  }: {
    userId: number;
    amountMinor: number;
  }): Promise<WithdrawalInitiateResult> {
    const data = await this.call<{ orderid: string | number }>("AccountPayout", {
      EndUserID: String(userId),
      MessageID: crypto.randomUUID(),
      NotificationURL: services.trustly.notificationUrl,
      Amount: (amountMinor / 100).toFixed(2),
      Currency: "USD",
      // TODO(vendor): populate AccountID (verified bank account ref), full attributes.
    });
    return {
      vendor: "trustly",
      vendorOrderId: String(data.orderid),
      status: "pending",
    };
  }

  async refund({ vendorOrderId }: { vendorOrderId: string }): Promise<{ status: "queued" }> {
    await this.call("Refund", {
      OrderID: vendorOrderId,
      MessageID: crypto.randomUUID(),
    });
    return { status: "queued" };
  }
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

export const trustlyProvider: PaymentProvider = new TrustlyProvider();
