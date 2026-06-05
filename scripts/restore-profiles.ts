// Recovery script: for every Supabase auth.users record that no longer has a
// profile row, recreate one with the username from user_metadata, a wallet,
// and the starter signup bonus. Picks/wins history is unrecoverable but the
// account itself returns to a usable state.
//
// Run with: npx tsx --env-file=.env.local scripts/restore-profiles.ts

import { eq } from "drizzle-orm";
import { db, pg } from "../src/db/client";
import { profiles, wallets } from "../src/db/schema";
import { genesisCredit } from "../src/lib/ledger-ops";
import { getSupabaseAdmin } from "../src/lib/supabase/admin";
import { STARTER_VIRTUAL_BALANCE_MINOR } from "../src/lib/config";

async function deriveUsername(email: string): Promise<string> {
  const base = (email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 17) || "user";
  let candidate = base;
  for (let n = 2; n < 1000; n++) {
    const taken = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
    candidate = `${base.slice(0, 17)}_${n}`;
  }
  return `${base}_${Math.random().toString(36).slice(2, 6)}`;
}

async function main() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;

  let restored = 0;
  let skipped = 0;

  for (const u of data.users) {
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.authUserId, u.id))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    const email = u.email ?? "unknown@example.com";
    const username =
      (u.user_metadata as { username?: string } | null)?.username ??
      (await deriveUsername(email));

    console.log(`Restoring profile for ${email} → @${username}`);

    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(profiles)
        .values({
          authUserId: u.id,
          username,
          termsAcceptedAt: new Date(),
        })
        .returning();
      await tx.insert(wallets).values({ userId: created.id });
      if (STARTER_VIRTUAL_BALANCE_MINOR > 0) {
        await genesisCredit(
          {
            userId: created.id,
            amountMinor: STARTER_VIRTUAL_BALANCE_MINOR,
            moneyKind: "virtual",
            reason: "signup_bonus",
            idempotencyKey: `restore_signup_bonus:${created.id}`,
          },
          tx,
        );
      }
    });
    restored++;
  }

  console.log(`Restored ${restored} profiles; ${skipped} already had one.`);
  await pg.end();
}

main().catch(async (e) => {
  console.error(e);
  await pg.end();
  process.exit(1);
});
