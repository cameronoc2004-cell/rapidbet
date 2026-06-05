// Exploit suite — runs against the live Supabase Postgres. Verifies the
// money-integrity invariants the new double-entry ledger is supposed to
// enforce:
//
//   (1) concurrent double-spend: two parallel buy-ins racing on a balance
//       that only covers one — exactly one succeeds, balance never negative.
//   (2) duplicate deposit webhook: posting the same Trustly orderId twice
//       only credits once.
//   (3) pool nets to zero after settlement.
//   (4) withdraw-then-spend: initiate withdraw, then try buy-in on the same
//       balance; the buy-in fails because available was reduced.
//
// Run with: npx tsx --env-file=.env.local scripts/e2e-ledger.ts
//
// SAFETY: refuses to run unless ALLOW_LEDGER_WIPE=1 is set. The wipe used by
// these tests truncates real tables — DO NOT run against a database that
// holds anything you care about. Use a throwaway / staging Supabase project.

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pg } from "../src/db/client";
import {
  accounts,
  auditLogs,
  entries,
  games,
  ledgerEntries,
  postings,
  profiles,
  questions,
  settlements,
  skillScores,
  transactions,
  wallets,
} from "../src/db/schema";
import {
  assertReconciles,
  getPoolBalance,
  getUserAvailable,
  getUserHeld,
  LedgerError,
} from "../src/db/ledger";
import {
  buyIn,
  depositConfirmed,
  genesisCredit,
  withdrawInitiate,
} from "../src/lib/ledger-ops";
import { settleQuestion, submitPrediction } from "../src/lib/contest";

function ok(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok:", msg);
}

async function wipe() {
  // Order matters because of FK constraints:
  //   - postings reference accounts (RESTRICT) — must clear before accounts
  //   - accounts reference questions (CASCADE), so cascade from question
  //     delete tries to drop accounts; postings on those accounts block it
  //   - audit_logs reference profiles (no cascade) — must clear before profiles
  await db.delete(auditLogs);
  await db.delete(postings);
  await db.delete(transactions);
  await db.delete(accounts);
  await db.delete(skillScores);
  await db.delete(settlements);
  await db.delete(entries);
  await db.delete(questions);
  await db.delete(games);
  await db.delete(ledgerEntries);
  await db.delete(wallets);
  await db.delete(profiles);
}

async function mkUser(username: string) {
  const [u] = await db
    .insert(profiles)
    .values({ authUserId: randomUUID(), username, termsAcceptedAt: new Date() })
    .returning();
  await db.insert(wallets).values({ userId: u.id });
  return u;
}

async function mkOpenQuestion(opts: {
  feeMinor: number;
  minEntrants?: number;
}) {
  const [g] = await db
    .insert(games)
    .values({
      league: "NFL",
      homeTeam: "Pats",
      awayTeam: "Jets",
      startsAt: new Date(Date.now() + 60_000),
      status: "in_progress",
    })
    .returning();
  const [q] = await db
    .insert(questions)
    .values({
      gameId: g.id,
      statType: "passing_yards",
      subject: "Maye",
      window: "Q1",
      title: "Maye passing yards Q1",
      entryFeeMinor: opts.feeMinor,
      moneyKind: "virtual",
      minEntrants: opts.minEntrants ?? 2,
      locksAt: new Date(Date.now() + 30 * 60_000),
    })
    .returning();
  return q;
}

async function main() {
  if (process.env.ALLOW_LEDGER_WIPE !== "1") {
    console.error(
      "Refusing to run: this test wipes profiles/accounts/postings/etc.\n" +
        "Set ALLOW_LEDGER_WIPE=1 and point DATABASE_URL at a throwaway DB.",
    );
    process.exit(2);
  }
  // ============================================================
  // Scenario 1: concurrent double-spend
  // ============================================================
  console.log("\n--- 1. concurrent double-spend ---");
  await wipe();
  const alice = await mkUser("alice");
  // Seed exactly enough for ONE entry.
  await genesisCredit({ userId: alice.id, amountMinor: 100, reason: "genesis" });

  const q1 = await mkOpenQuestion({ feeMinor: 100 });
  const q2 = await mkOpenQuestion({ feeMinor: 100 });

  // Fire two buy-ins in parallel against the same user. Only one should succeed.
  const results = await Promise.allSettled([
    submitPrediction({ questionId: q1.id, userId: alice.id, predictionValue: 5 }),
    submitPrediction({ questionId: q2.id, userId: alice.id, predictionValue: 5 }),
  ]);
  const wins = results.filter((r) => r.status === "fulfilled").length;
  const losses = results.filter((r) => r.status === "rejected").length;
  ok(wins === 1, `exactly one buy-in succeeded (got ${wins})`);
  ok(losses === 1, `the other was rejected (got ${losses})`);
  ok(
    (await getUserAvailable(alice.id, "virtual")) === 0,
    "available is 0 after the one successful buy-in",
  );
  ok(
    (await getUserHeld(alice.id, "virtual")) === 100,
    "held is 100 (the one in-flight entry)",
  );
  await assertReconciles("virtual");

  // ============================================================
  // Scenario 2: duplicate deposit webhook → idempotent
  // ============================================================
  console.log("\n--- 2. duplicate deposit webhook ---");
  await wipe();
  const bob = await mkUser("bob");

  const orderId = "trustly_test_123";
  const r1 = await depositConfirmed({
    userId: bob.id,
    amountMinor: 2500,
    trustlyOrderId: orderId,
    moneyKind: "real",
  });
  const r2 = await depositConfirmed({
    userId: bob.id,
    amountMinor: 2500,
    trustlyOrderId: orderId, // same id
    moneyKind: "real",
  });
  ok(r1.idempotentHit === false, "first deposit posted");
  ok(r2.idempotentHit === true, "second deposit no-op (idempotent)");
  ok(
    (await getUserAvailable(bob.id, "real")) === 2500,
    "balance still $25 after duplicate",
  );
  await assertReconciles("real");

  // ============================================================
  // Scenario 3: pool nets to zero after settlement
  // ============================================================
  console.log("\n--- 3. pool nets to zero after settle ---");
  await wipe();
  const u1 = await mkUser("u1");
  const u2 = await mkUser("u2");
  const u3 = await mkUser("u3");
  for (const u of [u1, u2, u3]) {
    await genesisCredit({ userId: u.id, amountMinor: 1000, reason: "genesis" });
  }

  const q3 = await mkOpenQuestion({ feeMinor: 500 });
  await submitPrediction({ questionId: q3.id, userId: u1.id, predictionValue: 10 });
  await submitPrediction({ questionId: q3.id, userId: u2.id, predictionValue: 20 });
  await submitPrediction({ questionId: q3.id, userId: u3.id, predictionValue: 30 });

  const s = await settleQuestion({ questionId: q3.id, officialResult: 19 });
  ok(s.winnersCount === 1, "one winner");
  // commission rate 0 in current config → winner takes the whole pot.
  ok(
    s.grossPoolMinor === 1500,
    `gross pool $15 (got ${s.grossPoolMinor})`,
  );
  ok(
    s.perWinnerMinor === 1500 - s.commissionMinor,
    "winner gets net (gross − commission)",
  );
  ok(
    (await getPoolBalance(q3.id, "virtual")) === 0,
    "pool account is exactly 0 after settle",
  );
  await assertReconciles("virtual");

  // ============================================================
  // Scenario 4: withdraw-then-spend → buy-in fails
  // ============================================================
  console.log("\n--- 4. withdraw-then-spend ---");
  await wipe();
  const carol = await mkUser("carol");
  // Real-money rail. Deposit $10, withdraw $10, then try to spend $10.
  await depositConfirmed({
    userId: carol.id,
    amountMinor: 1000,
    trustlyOrderId: "deposit_carol_1",
    moneyKind: "real",
  });
  ok(
    (await getUserAvailable(carol.id, "real")) === 1000,
    "carol available = $10 after deposit",
  );

  await withdrawInitiate({
    userId: carol.id,
    amountMinor: 1000,
    trustlyOrderId: "withdraw_carol_1",
    moneyKind: "real",
  });
  ok(
    (await getUserAvailable(carol.id, "real")) === 0,
    "available is 0 (moved to held)",
  );
  ok(
    (await getUserHeld(carol.id, "real")) === 1000,
    "held is $10",
  );

  // Now try to buy in to a real-money question. Should fail — available is 0.
  // (We have to set up a real-money question; in Phase 1 the moneyKind is
  // virtual, so simulate by calling buyIn directly.)
  let buyFailed = false;
  try {
    await buyIn({
      userId: carol.id,
      questionId: 999_999, // fake; ledger only cares about user accounts here
      entryId: 999_999,
      amountMinor: 1000,
      moneyKind: "real",
    });
  } catch (e) {
    buyFailed =
      e instanceof LedgerError && e.code === "insufficient_funds";
  }
  ok(buyFailed, "buy-in rejected after withdraw — withdraw-then-spend blocked");
  await assertReconciles("real");

  console.log("\nAll scenarios passed.");
  await pg.end();
}

main().catch(async (e) => {
  console.error(e);
  await pg.end();
  process.exit(1);
});
