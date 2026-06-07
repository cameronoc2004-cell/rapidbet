// Delete profiles whose auth_user_id no longer exists in Supabase auth.users.
// One-time cleanup; the app's deleteAccount action handles future deletions
// correctly. Manually deleting from the Supabase dashboard skips us.
//
// Usage: ALLOW_LEDGER_WIPE=1 npx tsx scripts/clear-orphans.ts

import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

async function main() {
  if (process.env.ALLOW_LEDGER_WIPE !== "1") {
    console.error("Refusing to run without ALLOW_LEDGER_WIPE=1");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SECRET_KEY!;
  const dbUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const sql = postgres(dbUrl, { max: 1 });

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 10000 });
  const liveAuthIds = new Set((list?.users ?? []).map((u) => u.id));
  console.log(`Live auth.users rows: ${liveAuthIds.size}`);

  const profiles = await sql<{ id: number; username: string; auth_user_id: string }[]>`
    SELECT id, username, auth_user_id FROM profiles
  `;

  const orphans = profiles.filter((p) => !liveAuthIds.has(p.auth_user_id));
  console.log(`Orphan profiles: ${orphans.length}`);
  if (orphans.length === 0) {
    await sql.end();
    return;
  }

  const ids = orphans.map((o) => o.id);

  // Nullify non-cascading FKs first (audit_log, questions.createdBy,
  // settlements.resolvedBy, transactions.actorUserId).
  await sql`UPDATE audit_logs SET actor_user_id = NULL WHERE actor_user_id = ANY(${ids})`;
  await sql`UPDATE questions SET created_by = NULL WHERE created_by = ANY(${ids})`;
  await sql`UPDATE settlements SET resolved_by = NULL WHERE resolved_by = ANY(${ids})`;
  await sql`UPDATE transactions SET actor_user_id = NULL WHERE actor_user_id = ANY(${ids})`;

  // Ledger cleanup. accounts → profiles cascades, but postings → accounts is
  // RESTRICT and postings → transactions is RESTRICT, so we have to unwind by
  // hand. For each orphan-owned account: find every transaction that touches
  // it, delete BOTH halves of those transactions (postings) so we don't leave
  // a half-posting referencing a system account, then delete the transactions
  // themselves, then delete the accounts.
  const orphanAccounts = await sql<{ id: number }[]>`
    SELECT id FROM accounts WHERE user_id = ANY(${ids})
  `;
  const orphanAccountIds = orphanAccounts.map((a) => a.id);
  if (orphanAccountIds.length > 0) {
    const touchedTx = await sql<{ transaction_id: number }[]>`
      SELECT DISTINCT transaction_id FROM postings WHERE account_id = ANY(${orphanAccountIds})
    `;
    const txIds = touchedTx.map((t) => t.transaction_id);
    if (txIds.length > 0) {
      await sql`DELETE FROM postings WHERE transaction_id = ANY(${txIds})`;
      await sql`DELETE FROM transactions WHERE id = ANY(${txIds})`;
      console.log(`  unwound ${txIds.length} ledger transaction(s) touching orphan accounts`);
    }
    await sql`DELETE FROM accounts WHERE id = ANY(${orphanAccountIds})`;
    console.log(`  removed ${orphanAccountIds.length} orphan ledger account(s)`);
  }

  const deleted = await sql`DELETE FROM profiles WHERE id = ANY(${ids}) RETURNING id, username`;
  for (const d of deleted) console.log(`  removed profile #${d.id} (${d.username})`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
