// =============================================================================
// SCHEMA — peer-to-peer skill-contest model
//
// Money columns are integer MINOR UNITS (cents). Never floats for money.
// Every money-moving table is paired with an immutable ledger row in
// ledger_entries — see lib/wallet.ts. Compliance tables (kyc/geo/limits/
// exclusions/audit) exist from day one even though Phase 1 stubs them out;
// they become the system of record the day real money turns on.
// =============================================================================

import {
  pgTable,
  pgEnum,
  text,
  integer,
  bigint,
  doublePrecision,
  timestamp,
  uuid,
  serial,
  primaryKey,
  index,
  uniqueIndex,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// --------- Enums ---------
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const kycStatusEnum = pgEnum("kyc_status", [
  "none",
  "pending",
  "verified",
  "rejected",
  "expired",
]);
export const moneyKindEnum = pgEnum("money_kind", ["virtual", "real"]);
export const ledgerReasonEnum = pgEnum("ledger_reason", [
  "signup_bonus",
  "deposit",
  "withdrawal",
  "entry_fee",
  "entry_refund",
  "payout",
  "commission",
  "admin_adjust",
]);
export const gameStatusEnum = pgEnum("game_status", [
  "scheduled",
  "in_progress",
  "final",
  "cancelled",
]);
export const questionStatusEnum = pgEnum("question_status", [
  "open",        // accepting entries
  "locked",      // entry window closed, awaiting official result
  "voided",      // min entrants not met → refunded
  "settled",     // winners paid, skill scored
]);
export const windowEnum = pgEnum("window_label", [
  "Q1", "Q2", "Q3", "Q4", "OT",
  "P1", "P2", "P3",          // hockey periods
  "I1", "I2", "I3", "I4", "I5", "I6", "I7", "I8", "I9",  // baseball innings
  "H1", "H2",                // soccer halves
  "GAME",                    // full-game
]);
export const geoCheckResultEnum = pgEnum("geo_check_result", [
  "permitted",
  "blocked",
  "unknown",
]);

// --------- Identity ---------
// 1:1 with Supabase auth.users. We never store passwords here.
// Onboarding gates are denormalized onto the row because they're checked on
// every gated page load. Email-verified is read from auth.users.email_confirmed_at
// directly (Supabase owns that).
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  username: text("username").notNull().unique(),
  role: userRoleEnum("role").notNull().default("user"),
  // Date of birth (ISO yyyy-mm-dd). Required to play; must be >= 18 today.
  dateOfBirth: text("date_of_birth"),
  // Two-letter US state code. Must be in PLAY_PERMITTED_STATES.
  stateCode: text("state_code"),
  // Non-null = user has cleared every onboarding gate.
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  // Notification preferences. Defaults: email + push for wins; nothing else opt-out.
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyPush: boolean("notify_push").notNull().default(true),
  // Timestamp when user accepted Terms of Service + Privacy Policy at signup.
  // Required before account creation completes; logged for legal evidence.
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  // Set when the user clicks "Skip for now" on the post-onboarding Get
  // Verified prompt. Suppresses the modal only — verification is still
  // required to enter contests; the user re-triggers it from /me.
  kycPromptDismissedAt: timestamp("kyc_prompt_dismissed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// --------- FCM device tokens ---------
// One row per registered device. A user typically has 1–3 (phone, tablet,
// browser). Pruned on send-failure (InvalidRegistration / NotRegistered).
export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: text("platform", { enum: ["web", "ios", "android"] }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("device_tokens_user_idx").on(t.userId)],
);

// --------- Payment orders (Trustly idempotency) ---------
// Every Trustly deposit/withdrawal starts here. The Trustly order_id is the
// idempotency key for inbound webhooks — duplicates flip to no-op.
// orderRef holds Trustly's order id; status reflects vendor lifecycle.
export const paymentOrderKindEnum = pgEnum("payment_order_kind", [
  "deposit",
  "withdrawal",
  "refund",
]);
export const paymentOrderStatusEnum = pgEnum("payment_order_status", [
  "pending",
  "confirmed",
  "failed",
  "cancelled",
]);
export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    vendor: text("vendor").notNull(),       // "trustly"
    vendorOrderId: text("vendor_order_id").notNull().unique(),
    kind: paymentOrderKindEnum("kind").notNull(),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    status: paymentOrderStatusEnum("status").notNull().default("pending"),
    // Last full webhook payload — useful for support + reconciliation.
    lastPayload: jsonb("last_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("payment_orders_user_idx").on(t.userId, t.createdAt)],
);

// --------- Wallet (single row per user) ---------
// virtualBalanceMinor: free-to-play; spends in Phase 1.
// realBalanceMinor: cash; ONLY moved when REAL_MONEY_ENABLED + all gates pass.
// Balances must equal SUM(ledger_entries.delta) for that user + kind. The
// invariant is checked in CI and on every settle.
export const wallets = pgTable("wallets", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  virtualBalanceMinor: bigint("virtual_balance_minor", { mode: "number" })
    .notNull()
    .default(0),
  realBalanceMinor: bigint("real_balance_minor", { mode: "number" })
    .notNull()
    .default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// --------- Ledger (append-only) ---------
// Every wallet change is one row here. Idempotency key prevents
// double-application of the same logical event (e.g. webhook retries).
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    moneyKind: moneyKindEnum("money_kind").notNull(),
    deltaMinor: bigint("delta_minor", { mode: "number" }).notNull(),
    balanceAfterMinor: bigint("balance_after_minor", { mode: "number" }).notNull(),
    reason: ledgerReasonEnum("reason").notNull(),
    refType: text("ref_type"),     // e.g. "question", "settlement"
    refId: integer("ref_id"),
    idempotencyKey: text("idempotency_key").unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ledger_user_idx").on(t.userId, t.moneyKind, t.createdAt)],
);

// --------- Games ---------
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  league: text("league").notNull(),
  // Free-text in Phase 1; in Phase 2 these come from the licensed data feed
  // and we add an external_ref column for the feed's primary key.  // TODO(vendor)
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  status: gameStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// --------- Questions (a question is a pool) ---------
// A pool is the financial container; one question = one pool in Phase 1.
// Pool aggregates (gross/net/commission) are computed and stored on settle —
// see settlements table.
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  // statType: e.g. "passing_yards", "rushing_tds", "points_scored", "first_downs"
  statType: text("stat_type").notNull(),
  // subject: player name or team. Free text in Phase 1; FK to feed entity later.
  subject: text("subject").notNull(),
  // Window of the game this question covers (Q1, GAME, I3, etc.).
  window: windowEnum("window").notNull(),
  // Display title — system-generated or admin-edited.
  title: text("title").notNull(),
  description: text("description"),
  entryFeeMinor: bigint("entry_fee_minor", { mode: "number" }).notNull(),
  // moneyKind tells us which wallet bucket the fee comes from.
  // In Phase 1 all questions are "virtual". Real-money questions blocked unless
  // REAL_MONEY_ENABLED + permitted state for the entrant.
  moneyKind: moneyKindEnum("money_kind").notNull().default("virtual"),
  minEntrants: integer("min_entrants").notNull().default(2),
  opensAt: timestamp("opens_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  locksAt: timestamp("locks_at", { withTimezone: true }).notNull(),
  status: questionStatusEnum("status").notNull().default("open"),
  createdBy: integer("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// --------- Entries ---------
export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    predictionValue: doublePrecision("prediction_value").notNull(),
    feePaidMinor: bigint("fee_paid_minor", { mode: "number" }).notNull(),
    moneyKind: moneyKindEnum("money_kind").notNull(),
    // Populated on settle. payoutMinor = 0 for non-winners; > 0 for winners.
    payoutMinor: bigint("payout_minor", { mode: "number" }),
    absError: doublePrecision("abs_error"),
    percentileRank: doublePrecision("percentile_rank"), // 0..1, 1 = best
    skillPointsAwarded: integer("skill_points_awarded"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("entries_one_per_user_per_q").on(t.questionId, t.userId),
    index("entries_user_idx").on(t.userId),
  ],
);

// --------- Settlements (one per resolved question) ---------
export const settlements = pgTable("settlements", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id")
    .notNull()
    .unique()
    .references(() => questions.id, { onDelete: "cascade" }),
  // The single source of truth for "what actually happened" on this stat.
  // Phase 1 = admin enters mock value. Phase 2 = licensed feed payload, stored
  // in officialResultPayload. NEVER settle real money on unofficial data.
  officialResult: doublePrecision("official_result").notNull(),
  officialResultPayload: jsonb("official_result_payload"),  // TODO(vendor)
  grossPoolMinor: bigint("gross_pool_minor", { mode: "number" }).notNull(),
  commissionMinor: bigint("commission_minor", { mode: "number" }).notNull(),
  netPoolMinor: bigint("net_pool_minor", { mode: "number" }).notNull(),
  winnersCount: integer("winners_count").notNull(),
  perWinnerMinor: bigint("per_winner_minor", { mode: "number" }).notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  resolvedBy: integer("resolved_by").references(() => profiles.id),
});

// --------- Skill scoring (legal + retention) ---------
// One row per (user, question). Cumulative skill = SUM(points) over time.
// Surfaced in /leaderboard for product purposes AND in audit reports as the
// evidentiary record of skill predominance over chance.
export const skillScores = pgTable(
  "skill_scores",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    season: text("season").notNull(),     // e.g. "2026"
    absError: doublePrecision("abs_error").notNull(),
    percentileRank: doublePrecision("percentile_rank").notNull(),
    pointsAwarded: integer("points_awarded").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    uniqueIndex("skill_one_per_user_per_q").on(t.userId, t.questionId),
    index("skill_season_idx").on(t.season, t.userId),
  ],
);

// --------- KYC ---------
// One row per verification attempt; latest row per user = current status.
// Phase 1 stub never inserts; Phase 2 vendor (Persona/Jumio/Veriff) writes here.
export const kycRecords = pgTable("kyc_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  status: kycStatusEnum("status").notNull().default("none"),
  vendor: text("vendor"),                            // "persona" | "jumio" | "veriff"
  vendorRef: text("vendor_ref"),                     // verification id
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  payload: jsonb("payload"),                         // raw vendor response
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// --------- Geo checks (per entry attempt) ---------
// Every real-money entry MUST be preceded by a fresh geo check from device GPS.
// Phase 1 inserts a "stubbed" record so the wiring is exercised end-to-end.
export const geoChecks = pgTable("geo_checks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  result: geoCheckResultEnum("result").notNull(),
  stateCode: text("state_code"),                     // two-letter US
  vendor: text("vendor"),                            // "geocomply" | "stub"
  vendorRef: text("vendor_ref"),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// --------- Responsible gaming ---------
export const responsibleGamingLimits = pgTable("responsible_gaming_limits", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  dailyDepositLimitMinor: bigint("daily_deposit_limit_minor", { mode: "number" }),
  weeklyDepositLimitMinor: bigint("weekly_deposit_limit_minor", { mode: "number" }),
  sessionRemindEveryMinutes: integer("session_remind_every_minutes"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const selfExclusions = pgTable("self_exclusions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  endsAt: timestamp("ends_at", { withTimezone: true }),    // null = indefinite
  reason: text("reason"),
});

// --------- Double-entry ledger ---------
// Money integrity is held by THIS subsystem, not the wallets table. Balances
// are NEVER stored as a mutable field — they're always derived from the sum
// of postings against an account.
// See LEDGER.md / src/db/ledger.ts for the model + invariants.
export const accountKindEnum = pgEnum("account_kind", [
  "user_available",
  "user_held",
  "pool",
  "house_rake",
  "external_rail",
]);

export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    // Canonical string key. Unique. Lets the rest of the app look up an
    // account by intent without remembering numeric IDs.
    //   user:{id}:available:{moneyKind}
    //   user:{id}:held:{moneyKind}
    //   pool:{questionId}:{moneyKind}
    //   house:rake:{moneyKind}
    //   ext:{rail}:{moneyKind}      (e.g. ext:trustly:real, ext:genesis:virtual)
    key: text("key").notNull().unique(),
    kind: accountKindEnum("kind").notNull(),
    userId: integer("user_id").references(() => profiles.id, { onDelete: "cascade" }),
    questionId: integer("question_id").references(() => questions.id, { onDelete: "cascade" }),
    moneyKind: moneyKindEnum("money_kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId, t.kind, t.moneyKind),
    index("accounts_question_idx").on(t.questionId),
    index("accounts_kind_idx").on(t.kind, t.moneyKind),
  ],
);

// One row per logical money event. Its postings (1..N) must sum to zero.
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  // semantic event tag: deposit | buyin | lock | void_refund | settle_rake |
  // settle_payout | withdraw_initiate | withdraw_confirm | withdraw_fail |
  // signup_bonus | genesis | admin_adjust
  kind: text("kind").notNull(),
  idempotencyKey: text("idempotency_key").unique(),
  refType: text("ref_type"),
  refId: integer("ref_id"),
  payload: jsonb("payload"),
  actorUserId: integer("actor_user_id").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// The actual line items. amountMinor is signed: positive = credit to that
// account, negative = debit from it. Append-only, never mutated. Corrections
// are new reversing transactions.
export const postings = pgTable(
  "postings",
  {
    id: serial("id").primaryKey(),
    transactionId: integer("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id),
    amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("postings_account_idx").on(t.accountId),
    index("postings_transaction_idx").on(t.transactionId),
  ],
);

// --------- Audit log (every sensitive action) ---------
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => profiles.id),
    action: text("action").notNull(),                // e.g. "entry.submit"
    refType: text("ref_type"),
    refId: integer("ref_id"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("audit_actor_idx").on(t.actorUserId, t.createdAt)],
);

// --------- Convenience type exports ---------
export type MoneyKind = "virtual" | "real";
export type QuestionStatus = "open" | "locked" | "voided" | "settled";
export type WindowLabel =
  | "Q1" | "Q2" | "Q3" | "Q4" | "OT"
  | "P1" | "P2" | "P3"
  | "I1" | "I2" | "I3" | "I4" | "I5" | "I6" | "I7" | "I8" | "I9"
  | "H1" | "H2"
  | "GAME";
