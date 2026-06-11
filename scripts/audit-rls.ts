// Inventory public-schema tables and their RLS / policy state.
//
// Usage: npx tsx scripts/audit-rls.ts

import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DIRECT_URL / DATABASE_URL");
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });

  const rows = await sql<{ tablename: string; rls_enabled: boolean; policies: number }[]>`
    SELECT
      t.tablename,
      c.relrowsecurity AS rls_enabled,
      (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = t.tablename AND p.schemaname = 'public') AS policies
    FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
    ORDER BY c.relrowsecurity, t.tablename
  `;

  for (const r of rows) {
    const mark = r.rls_enabled ? "✓ RLS" : "✗ EXPOSED";
    console.log(
      `${r.tablename.padEnd(36)} ${mark.padEnd(12)} ${r.policies} policies`,
    );
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
