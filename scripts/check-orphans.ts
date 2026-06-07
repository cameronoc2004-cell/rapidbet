// Find profiles rows whose auth_user_id no longer exists in Supabase auth.users.
// Manually deleting an auth user via the Supabase dashboard does NOT cascade
// to our profiles table — those rows survive and can block re-signup if the
// auto-derived username keeps colliding.
//
// Usage: npx tsx scripts/check-orphans.ts <email-to-investigate>

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/check-orphans.ts <email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SECRET_KEY!;
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const sql = postgres(dbUrl, { max: 1 });

  // 1. Anything in Supabase auth.users for this email?
  const { data: list } = await admin.auth.admin.listUsers();
  const authUsers = (list?.users ?? []).filter(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  console.log(`Supabase auth.users with email=${email}: ${authUsers.length}`);
  for (const u of authUsers) {
    console.log(`  id=${u.id}  created=${u.created_at}  confirmed=${u.email_confirmed_at ?? "no"}`);
  }

  // 2. Any profiles row whose auth_user_id is in that set, OR derived-username
  //    collision against the email's local part?
  const localPart = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") ?? "";
  const profileRows = await sql`
    SELECT id, auth_user_id, username, created_at
    FROM profiles
    WHERE username LIKE ${localPart + "%"}
       OR auth_user_id::text = ANY(${authUsers.map((u) => u.id)})
    ORDER BY created_at DESC
  `;
  console.log(`\nProfiles rows matching: ${profileRows.length}`);
  for (const p of profileRows) {
    const linkedAuthExists = authUsers.some((u) => u.id === p.auth_user_id);
    console.log(
      `  id=${p.id}  username=${p.username}  auth_user_id=${p.auth_user_id}  ${
        linkedAuthExists ? "[LINKED]" : "[ORPHAN — auth.users row gone]"
      }`,
    );
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
