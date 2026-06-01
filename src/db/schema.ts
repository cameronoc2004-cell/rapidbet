import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  uuid,
  primaryKey,
  index,
  serial,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Currency types are kept as a string union enforced at the app layer.
// "GC" = Gold Coins (play money, never redeemable for cash).
// "SC" = Sweeps Coins (promotional only, redeemable for cash prizes once compliance is in place).
// Building both rails now so the conversion later is a config flip, not a rewrite.
export type Currency = "GC" | "SC";

export const currencyEnum = pgEnum("currency", ["GC", "SC"]);
export const roleEnum = pgEnum("user_role", ["user", "admin"]);
export const kycEnum = pgEnum("kyc_status", ["none", "pending", "verified"]);
export const quarterEnum = pgEnum("quarter", ["Q1", "Q2", "Q3", "Q4", "OT"]);
export const questionStatusEnum = pgEnum("question_status", [
  "open",
  "closed",
  "resolved",
]);
export const ledgerReasonEnum = pgEnum("ledger_reason", [
  "signup_bonus",
  "entry_buyin",
  "entry_refund",
  "payout",
  "admin_adjust",
]);

// Profile rows are 1:1 with Supabase auth.users. We never store passwords here;
// Supabase Auth owns identity. authUserId is the link.
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  authUserId: uuid("auth_user_id").notNull().unique(),
  username: text("username").notNull().unique(),
  role: roleEnum("role").notNull().default("user"),
  // Sweepstakes-readiness stubs — populated on KYC flow later.
  kycStatus: kycEnum("kyc_status").notNull().default("none"),
  stateCode: text("state_code"),
  dateOfBirth: text("date_of_birth"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export const balances = pgTable(
  "balances",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    currency: currencyEnum("currency").notNull(),
    amount: integer("amount").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.currency] })],
);

// Append-only audit log. Every balance change MUST insert a row here.
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    currency: currencyEnum("currency").notNull(),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: ledgerReasonEnum("reason").notNull(),
    refType: text("ref_type"),
    refId: integer("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("ledger_user_idx").on(t.userId, t.currency, t.createdAt)],
);

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  team: text("team").notNull(),
  gameLabel: text("game_label").notNull(),
  quarter: quarterEnum("quarter").notNull(),
  buyInAmount: integer("buy_in_amount").notNull(),
  currency: currencyEnum("currency").notNull(),
  status: questionStatusEnum("status").notNull().default("open"),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  actualValue: doublePrecision("actual_value"),
  createdBy: integer("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

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
    guessValue: doublePrecision("guess_value").notNull(),
    amountPaid: integer("amount_paid").notNull(),
    currency: currencyEnum("currency").notNull(),
    wonAmount: integer("won_amount"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index("entries_q_user_idx").on(t.questionId, t.userId)],
);
