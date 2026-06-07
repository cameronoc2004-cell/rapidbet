// Sandbox smoke test for Didit /v3 session create.
//
// Reads DIDIT_API_KEY + DIDIT_WORKFLOW_ID from .env.local, hits the live
// session-create endpoint, and prints the hosted verification URL.
//
//   npx tsx scripts/didit-smoke.ts
//
// Open the printed URL on your phone, run through ID + selfie + face match.
// Watch /api/webhooks/didit on the deployed app (or via vercel logs) to see
// the status.updated webhook fire.

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const API_KEY = process.env.DIDIT_API_KEY ?? "";
  const WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID ?? "";

  if (!API_KEY || !WORKFLOW_ID) {
    console.error("Missing DIDIT_API_KEY or DIDIT_WORKFLOW_ID in env.");
    process.exit(1);
  }

  const body = {
    workflow_id: WORKFLOW_ID,
    vendor_data: `smoke-${Date.now()}`,
    callback: "https://rallypot.org/me",
    contact_details: { email: "cameronoc2004@gmail.com" },
  };

  const res = await fetch("https://verification.didit.me/v3/session/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`HTTP ${res.status}\n${text}`);
    process.exit(1);
  }

  const data = JSON.parse(text) as {
    session_id: string;
    url: string;
    status: string;
    workflow_id: string;
  };

  console.log("session_id : ", data.session_id);
  console.log("status     : ", data.status);
  console.log("workflow   : ", data.workflow_id);
  console.log("\nOpen this on your phone:\n");
  console.log("  " + data.url);
  console.log("\nAfter completing, check the audit log:");
  console.log(
    "  supabase: select * from audit_log where action like 'didit.webhook%' order by id desc limit 10;",
  );
}

main();
