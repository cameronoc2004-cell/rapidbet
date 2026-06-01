// End-to-end test of the contest engine against the live Supabase Postgres.
// Wipes test data, creates 3 synthetic users (no Supabase Auth), runs three
// scenarios: clear winner, tie split, min-entrants void. Verifies wallet vs
// ledger invariant after every settle.
//
// Run with: npx tsx scripts/e2e-contest.ts

import { config } from "dotenv";
config({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, pg } from "../src/db/client";
import {
  profiles,
  wallets,
  games,
  questions,
  entries,
  settlements,
  skillScores,
  ledgerEntries,
  auditLogs,
} from "../src/db/schema";
import { postWalletTx, assertLedgerInvariant, getWallet } from "../src/db/wallet";
import { submitPrediction, settleQuestion, voidQuestion } from "../src/lib/contest";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok:", msg);
}

async function wipe() {
  // Order matters because of FKs; wipe in reverse-dep order.
  await db.delete(auditLogs);
  await db.delete(skillScores);
  await db.delete(settlements);
  await db.delete(entries);
  await db.delete(questions);
  await db.delete(games);
  await db.delete(ledgerEntries);
  await db.delete(wallets);
  await db.delete(profiles);
}

async function mkUser(username: string, starterCents: number) {
  const [u] = await db
    .insert(profiles)
    .values({ authUserId: randomUUID(), username })
    .returning();
  await db.insert(wallets).values({ userId: u.id });
  if (starterCents > 0) {
    await postWalletTx({
      userId: u.id,
      moneyKind: "virtual",
      deltaMinor: starterCents,
      reason: "signup_bonus",
      idempotencyKey: `signup_bonus:${u.id}`,
    });
  }
  return u;
}

async function mkQuestion(opts: {
  entryFeeCents: number;
  minEntrants?: number;
  locksAtOffsetMs?: number;
}) {
  const [g] = await db
    .insert(games)
    .values({
      league: "NFL",
      homeTeam: "Patriots",
      awayTeam: "Jets",
      startsAt: new Date(Date.now() + 60_000),
    })
    .returning();
  const [q] = await db
    .insert(questions)
    .values({
      gameId: g.id,
      statType: "passing_yards",
      subject: "Mac Jones",
      window: "Q1",
      title: "Passing yards in Q1",
      entryFeeMinor: opts.entryFeeCents,
      moneyKind: "virtual",
      minEntrants: opts.minEntrants ?? 2,
      locksAt: new Date(Date.now() + (opts.locksAtOffsetMs ?? 60 * 60_000)),
    })
    .returning();
  return q;
}

async function main() {
  // ----- Scenario 1: clear winner, 1% commission, ledger invariant -----
  console.log("\n--- scenario 1: clear winner ---");
  await wipe();
  const alice = await mkUser("alice", 10_000);
  const bob = await mkUser("bob", 10_000);
  const cara = await mkUser("cara", 10_000);

  const q1 = await mkQuestion({ entryFeeCents: 500 });
  await submitPrediction({ questionId: q1.id, userId: alice.id, predictionValue: 50 });
  await submitPrediction({ questionId: q1.id, userId: bob.id, predictionValue: 75 });
  await submitPrediction({ questionId: q1.id, userId: cara.id, predictionValue: 100 });

  for (const u of [alice, bob, cara]) {
    const w = await getWallet(u.id);
    assert(w.virtualMinor === 9500, `${u.username} debited $5`);
  }

  // Actual = 73 → bob (75) is closest by 2.
  // gross = 1500c, commission = floor(1500*100/10000) = 15c, net = 1485c.
  // bob wins 1485c → balance 9500 + 1485 = 10985.
  const s1 = await settleQuestion({ questionId: q1.id, officialResult: 73 });
  assert(s1.grossPoolMinor === 1500, "gross = $15");
  assert(s1.commissionMinor === 15, "commission = $0.15 (1%)");
  assert(s1.netPoolMinor === 1485, "net = $14.85");
  assert(s1.winnersCount === 1, "one winner");
  assert(s1.perWinnerMinor === 1485, "bob wins entire net pool");

  const bobAfter = await getWallet(bob.id);
  assert(bobAfter.virtualMinor === 9500 + 1485, "bob balance = $109.85");
  const aliceAfter = await getWallet(alice.id);
  assert(aliceAfter.virtualMinor === 9500, "alice unchanged after settle");

  for (const u of [alice, bob, cara]) {
    await assertLedgerInvariant(u.id);
  }
  console.log("ok: ledger invariant holds for all 3 users");

  // ----- Scenario 2: tie split, with remainder absorbed into commission -----
  console.log("\n--- scenario 2: tie split ---");
  await wipe();
  const u1 = await mkUser("u1", 10_000);
  const u2 = await mkUser("u2", 10_000);
  const u3 = await mkUser("u3", 10_000);

  // Fees that make the math interesting: 3 * 333c = 999c gross.
  // commission floor(999 * 100/10000) = 9c. Base net = 990c.
  // Split between 2 winners: floor(990/2) = 495c each → 990 total, no extra.
  // But if odd: try 7c entries: 3 * 7c = 21c, commission = 0c, net 21c,
  // split 2 ways = floor(21/2) = 10c, remainder 1c → commission.
  const q2 = await mkQuestion({ entryFeeCents: 7 });
  await submitPrediction({ questionId: q2.id, userId: u1.id, predictionValue: 10 });
  await submitPrediction({ questionId: q2.id, userId: u2.id, predictionValue: 12 });
  await submitPrediction({ questionId: q2.id, userId: u3.id, predictionValue: 15 });
  // actual = 11 → u1 (err 1) and u2 (err 1) tie
  const s2 = await settleQuestion({ questionId: q2.id, officialResult: 11 });
  assert(s2.grossPoolMinor === 21, "gross 21c");
  assert(s2.netPoolMinor === 20, "net 20c after per-winner floor");
  // commission = floor(21*100/10000)=0, plus remainder 1c absorbed = 1c
  assert(s2.commissionMinor === 1, "commission absorbs the 1c split remainder");
  assert(s2.perWinnerMinor === 10, "10c per winner");
  assert(s2.winnersCount === 2, "two winners");

  const u1After = await getWallet(u1.id);
  const u2After = await getWallet(u2.id);
  const u3After = await getWallet(u3.id);
  assert(u1After.virtualMinor === 10_000 - 7 + 10, "u1 = 10003");
  assert(u2After.virtualMinor === 10_000 - 7 + 10, "u2 = 10003");
  assert(u3After.virtualMinor === 10_000 - 7, "u3 = 9993");

  // Skill scores: u1 and u2 tied at lowest err so both get same percentile (1.0)
  // u3 has higher err so percentile is lower.
  const scoresQ2 = await db.select().from(skillScores).where(eq(skillScores.questionId, q2.id));
  const u1Score = scoresQ2.find((s) => s.userId === u1.id)!;
  const u2Score = scoresQ2.find((s) => s.userId === u2.id)!;
  const u3Score = scoresQ2.find((s) => s.userId === u3.id)!;
  assert(u1Score.percentileRank === u2Score.percentileRank, "tied winners get same percentile");
  assert(u1Score.percentileRank > u3Score.percentileRank, "winners > loser percentile");

  for (const u of [u1, u2, u3]) await assertLedgerInvariant(u.id);

  // ----- Scenario 3: min-entrants not met → void + refund -----
  console.log("\n--- scenario 3: min entrants not met → void ---");
  await wipe();
  const lone = await mkUser("lone", 10_000);
  const q3 = await mkQuestion({ entryFeeCents: 500, minEntrants: 2 });
  await submitPrediction({ questionId: q3.id, userId: lone.id, predictionValue: 42 });
  assert((await getWallet(lone.id)).virtualMinor === 9500, "lone debited 500c");
  const s3 = await settleQuestion({ questionId: q3.id, officialResult: 50 });
  assert(s3.voided === true, "settle of min-not-met converts to void");
  assert((await getWallet(lone.id)).virtualMinor === 10_000, "lone fully refunded");
  await assertLedgerInvariant(lone.id);

  // ----- Scenario 4: explicit voidQuestion API works too -----
  console.log("\n--- scenario 4: explicit voidQuestion ---");
  await wipe();
  const x = await mkUser("x", 10_000);
  const y = await mkUser("y", 10_000);
  const q4 = await mkQuestion({ entryFeeCents: 200 });
  await submitPrediction({ questionId: q4.id, userId: x.id, predictionValue: 1 });
  await submitPrediction({ questionId: q4.id, userId: y.id, predictionValue: 2 });
  const v = await voidQuestion({ questionId: q4.id, reason: "game_cancelled" });
  assert(v.refunded === 2, "both refunded");
  assert((await getWallet(x.id)).virtualMinor === 10_000, "x refunded");
  assert((await getWallet(y.id)).virtualMinor === 10_000, "y refunded");
  await assertLedgerInvariant(x.id);
  await assertLedgerInvariant(y.id);

  // ----- Scenario 5: idempotency -----
  console.log("\n--- scenario 5: idempotent ledger post ---");
  await wipe();
  const z = await mkUser("z", 0);
  const r1 = await postWalletTx({
    userId: z.id, moneyKind: "virtual", deltaMinor: 100, reason: "admin_adjust",
    idempotencyKey: "adj_001",
  });
  const r2 = await postWalletTx({
    userId: z.id, moneyKind: "virtual", deltaMinor: 100, reason: "admin_adjust",
    idempotencyKey: "adj_001",
  });
  assert(r1.idempotentHit === false, "first post applies");
  assert(r2.idempotentHit === true, "second post no-ops");
  assert((await getWallet(z.id)).virtualMinor === 100, "balance only applied once");

  console.log("\nAll scenarios passed.");
  await pg.end();
}

main().catch(async (e) => {
  console.error(e);
  await pg.end();
  process.exit(1);
});
