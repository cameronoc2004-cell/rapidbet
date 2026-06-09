// Delete Supabase auth.users rows that have no matching profiles row.
//
// Used to be created when the app's deleteAccount action successfully
// deleted the profile but failed silently on supabase auth deletion (old
// silent-catch). The action has since been hardened, but the orphan rows
// from past failures still need a one-time sweep.
//
// Also catches sign-up attempts that errored mid-flight — supabase
// creates the auth user before our profile insert, so a failed signup
// can leave an auth row with no matching profile.
//
// Usage: ALLOW_LEDGER_WIPE=1 npx tsx scripts/clear-auth-orphans.ts
//        ALLOW_LEDGER_WIPE=1 npx tsx scripts/clear-auth-orphans.ts --dry

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

async function main() {
  if (process.env.ALLOW_LEDGER_WIPE !== "1") {
    console.error("Refusing to run without ALLOW_LEDGER_WIPE=1");
    process.exit(1);
  }
  const dry = process.argv.includes("--dry");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SECRET_KEY!;
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const sql = postgres(dbUrl, { max: 1 });

  // Pull live auth.users.
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 10000 });
  if (error) {
    console.error("listUsers failed:", error);
    process.exit(1);
  }
  const authUsers = list?.users ?? [];
  console.log(`Live auth.users rows: ${authUsers.length}`);

  // Pull our profiles' auth_user_ids.
  const profileAuthIds = new Set(
    (await sql<{ auth_user_id: string }[]>`SELECT auth_user_id FROM profiles`).map(
      (r) => r.auth_user_id,
    ),
  );

  // Orphans = auth users with no matching profile.
  const orphans = authUsers.filter((u) => !profileAuthIds.has(u.id));
  console.log(`Orphan auth.users (no matching profile): ${orphans.length}`);
  for (const u of orphans) {
    console.log(`  ${u.id}  ${u.email ?? "(no email)"}  created=${u.created_at}`);
  }

  await sql.end();

  if (orphans.length === 0 || dry) {
    if (dry) console.log("\n(dry run — pass without --dry to delete)");
    return;
  }

  console.log("\nDeleting…");
  for (const u of orphans) {
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    if (delErr) {
      console.error(`  FAILED ${u.id}: ${delErr.message}`);
    } else {
      console.log(`  removed ${u.id} (${u.email ?? "no email"})`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
