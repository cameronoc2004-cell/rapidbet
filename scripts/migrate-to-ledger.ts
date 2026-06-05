// One-off migration: for every existing wallet row with a positive virtual
// balance, post a "genesis" transaction that credits user:available from a
// synthetic external rail (ext:genesis). After this runs, the new ledger's
// derived balance for each user matches their old stored balance, and the
// reconciliation invariant holds.
//
// Idempotent — uses idempotency key per user.
//
// Run with: npx tsx --env-file=.env.local scripts/migrate-to-ledger.ts

import { db, pg } from "../src/db/client";
import { wallets } from "../src/db/schema";
import {
  assertReconciles,
  getUserAvailable,
  LedgerError,
} from "../src/db/ledger";
import { genesisCredit } from "../src/lib/ledger-ops";

async function main() {
  const rows = await db.select().from(wallets);
  console.log(`Found ${rows.length} wallet rows.`);

  let migrated = 0;
  let skipped = 0;

  for (const w of rows) {
    if (w.virtualBalanceMinor <= 0) {
      skipped++;
      continue;
    }
    try {
      await genesisCredit({
        userId: w.userId,
        amountMinor: w.virtualBalanceMinor,
        moneyKind: "virtual",
        reason: "genesis",
        idempotencyKey: `migrate_to_ledger:virtual:${w.userId}`,
      });
      const derived = await getUserAvailable(w.userId, "virtual");
      if (derived !== w.virtualBalanceMinor) {
        console.warn(
          `user ${w.userId}: expected ${w.virtualBalanceMinor}, got ${derived}`,
        );
      }
      migrated++;
    } catch (e) {
      if (e instanceof LedgerError) {
        console.error(`user ${w.userId}: ${e.code} ${e.message}`);
      } else {
        throw e;
      }
    }
  }

  console.log(`Migrated ${migrated} wallets; skipped ${skipped} (zero balance).`);

  // Final sanity check.
  await assertReconciles("virtual");
  console.log("Virtual ledger reconciles cleanly.");

  await pg.end();
}

main().catch(async (e) => {
  console.error(e);
  await pg.end();
  process.exit(1);
});
