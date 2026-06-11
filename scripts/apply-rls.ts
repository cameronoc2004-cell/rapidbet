// Apply drizzle/rls.sql to the live Supabase database.
//
// Safe to re-run: every CREATE POLICY in rls.sql is preceded by a DROP POLICY
// IF EXISTS, and ALTER TABLE … ENABLE RLS is idempotent.
//
// Why a script instead of just pasting in the dashboard? Catching a typo
// after a partial paste is annoying; running through the connection we
// already use for migrations means the same auth path the rest of the app
// uses, so success here proves the secret works.
//
// Usage:  npx tsx scripts/apply-rls.ts

import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DIRECT_URL / DATABASE_URL");
    process.exit(1);
  }
  const sqlText = readFileSync(resolve("drizzle/rls.sql"), "utf8");
  const sql = postgres(url, { max: 1 });
  try {
    // .unsafe runs the whole script as a single multi-statement transaction.
    // Any failure (typo, missing table) rolls back everything.
    await sql.unsafe(sqlText);
    console.log("RLS applied.");
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
