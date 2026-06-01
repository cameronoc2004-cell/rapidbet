// Wipes contest state and inserts ONE live event with 3 open questions on
// staggered lock times. Tops up existing wallets so the demo is playable.
//
// Usage: npx tsx --env-file=.env.local scripts/seed-demo.ts

import { eq } from "drizzle-orm";
import { db, pg } from "../src/db/client";
import {
  auditLogs,
  entries,
  games,
  ledgerEntries,
  questions,
  settlements,
  skillScores,
  wallets,
} from "../src/db/schema";

async function main() {
  // Wipe contest-related state, preserve profiles + wallets so signed-in users
  // keep their accounts.
  await db.delete(auditLogs);
  await db.delete(skillScores);
  await db.delete(settlements);
  await db.delete(entries);
  await db.delete(questions);
  await db.delete(games);

  const now = new Date();
  const [game] = await db
    .insert(games)
    .values({
      league: "NFL",
      homeTeam: "Patriots",
      awayTeam: "Jets",
      startsAt: new Date(now.getTime() - 30 * 60_000),
      status: "in_progress",
    })
    .returning();

  const baseQ = { gameId: game.id, moneyKind: "virtual" as const, minEntrants: 2 };
  await db.insert(questions).values([
    {
      ...baseQ,
      title: "How many passing yards in Q2?",
      description: "Total passing yards by Drake Maye in Q2.",
      statType: "passing_yards",
      subject: "Drake Maye",
      window: "Q2",
      entryFeeMinor: 100,
      locksAt: new Date(now.getTime() + 5 * 60_000),
    },
    {
      ...baseQ,
      title: "Total points scored by home team in Q3?",
      statType: "points_scored",
      subject: "Patriots",
      window: "Q3",
      entryFeeMinor: 200,
      locksAt: new Date(now.getTime() + 25 * 60_000),
    },
    {
      ...baseQ,
      title: "First downs by away team in Q4?",
      statType: "first_downs",
      subject: "Jets",
      window: "Q4",
      entryFeeMinor: 500,
      locksAt: new Date(now.getTime() + 90 * 60_000),
    },
  ]);

  // Top up any existing wallets to $100 demo balance.
  const existing = await db.select().from(wallets);
  for (const w of existing) {
    if (w.virtualBalanceMinor < 1000) {
      const target = 10_000;
      const delta = target - w.virtualBalanceMinor;
      await db
        .update(wallets)
        .set({ virtualBalanceMinor: target, updatedAt: new Date() })
        .where(eq(wallets.userId, w.userId));
      await db.insert(ledgerEntries).values({
        userId: w.userId,
        moneyKind: "virtual",
        deltaMinor: delta,
        balanceAfterMinor: target,
        reason: "admin_adjust",
        idempotencyKey: `demo_topup:${w.userId}:${Date.now()}`,
      });
    }
  }

  console.log(`Seeded game #${game.id} with 3 open questions.`);
  await pg.end();
}

main().catch(async (e) => {
  console.error(e);
  await pg.end();
  process.exit(1);
});
