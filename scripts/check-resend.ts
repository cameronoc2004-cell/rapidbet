// Diagnose why Supabase signup confirmation emails aren't going out.
//
// Checks, in order:
// 1. Is RESEND_API_KEY present and accepted? (lists domains)
// 2. Is rallypot.org in the domains list? Is it verified?
// 3. Try a real send from noreply@rallypot.org via the Resend API. The
//    exact error tells us whether the issue is domain verification, key
//    permissions, or something else.
//
// Usage:  npx tsx scripts/check-resend.ts cameronoc2004@gmail.com

import { config } from "dotenv";
config({ path: ".env.local" });

const apiKey = process.env.RESEND_API_KEY ?? "";
const to = process.argv[2] ?? "cameronoc2004@gmail.com";

if (!apiKey) {
  console.error("Missing RESEND_API_KEY in .env.local");
  process.exit(1);
}

async function main() {
  console.log(`Resend API key: ${apiKey.slice(0, 8)}… (${apiKey.length} chars)`);

  // 1 + 2: list domains.
  const domains = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const domainsBody = await domains.text();
  if (!domains.ok) {
    console.error(`\nDomains GET failed (HTTP ${domains.status}):\n${domainsBody}`);
    process.exit(1);
  }
  const list = JSON.parse(domainsBody) as { data: Array<{ name: string; status: string; region: string }> };
  console.log(`\nDomains registered with this Resend account:`);
  if (list.data.length === 0) {
    console.log("  (none)");
  } else {
    for (const d of list.data) {
      console.log(`  ${d.name.padEnd(20)} status=${d.status}  region=${d.region}`);
    }
  }
  const rallypot = list.data.find((d) => d.name === "rallypot.org");
  if (!rallypot) {
    console.log(`\n⚠ rallypot.org is NOT registered. Supabase using noreply@rallypot.org will be rejected at the Resend gateway.`);
  } else if (rallypot.status !== "verified") {
    console.log(`\n⚠ rallypot.org is registered but status="${rallypot.status}" (not verified). Sends from this domain will be rejected.`);
  } else {
    console.log(`\n✓ rallypot.org is verified.`);
  }

  // 3: actual send attempt.
  console.log(`\nAttempting a test send to ${to} from noreply@rallypot.org …`);
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Rallypot <noreply@rallypot.org>",
      to,
      subject: "Rallypot SMTP diagnostic",
      text: "This is a diagnostic email from scripts/check-resend.ts.",
    }),
  });
  const sendBody = await send.text();
  console.log(`HTTP ${send.status}\n${sendBody}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
