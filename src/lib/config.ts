// =============================================================================
// PRODUCT + COMPLIANCE CONFIG
//
// This file holds the gates that separate Phase 1 (free-to-play, ships now) from
// Phase 2 (real-money, ships AFTER: legal opinion + KYC vendor + geo vendor +
// gaming-payment processor + populated PERMITTED_STATES). All gates DEFAULT TO
// THE CLOSED / SAFE STATE.
//
// READ BEFORE CHANGING ANY DEFAULT: ../../AGENTS.md and the project brief.
// Money is never enabled by code change alone — it requires every dependency
// below to be live AND a written legal opinion in hand. // TODO(legal)
// =============================================================================

// Master kill-switch for any real-money flow. STAYS FALSE in Phase 1.
// Flipping this to true is not a code decision — it is a legal + operations
// decision documented elsewhere. Every code path that handles cash MUST also
// check REAL_MONEY_ENABLED at runtime.
export const REAL_MONEY_ENABLED =
  process.env.REAL_MONEY_ENABLED === "true";

// Two-letter US state codes where REAL-MONEY entry is legally permitted.
// EMPTY UNTIL POPULATED BY GAMING COUNSEL. The geo check rejects everywhere
// not listed here. Do not hardcode — read from env so legal can change without
// a deploy. // TODO(legal)
export const PERMITTED_STATES: string[] = (process.env.PERMITTED_STATES ?? "")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter((s) => /^[A-Z]{2}$/.test(s));

// US states where FREE-TO-PLAY is permitted. Defaults to all 50 + DC in Phase 1
// because there is no money involved. Override via env if counsel restricts the
// play-money experience too.
const ALL_US = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];
export const PLAY_PERMITTED_STATES: string[] = (() => {
  const env = process.env.PLAY_PERMITTED_STATES;
  if (!env) return ALL_US;
  const list = env.split(",").map((s) => s.trim().toUpperCase()).filter((s) => /^[A-Z]{2}$/.test(s));
  return list.length > 0 ? list : ALL_US;
})();

// Minimum age for free-to-play. Real-money mode uses the stricter MIN_AGE_YEARS.
export const PLAY_MIN_AGE_YEARS = Number(process.env.PLAY_MIN_AGE_YEARS ?? 18);

// Operator commission on each pool, in basis points. 100 bps = 1.00%.
// Revenue comes ONLY from this — operator never takes a position, never sets a
// line, never holds stake in any outcome. This is what keeps the product
// peer-to-peer.
export const COMMISSION_RATE_BPS = Number(
  process.env.COMMISSION_RATE_BPS ?? 100,
);

// Free-to-play starter balance in MINOR UNITS (cents). $100 by default.
// All money math everywhere in this app is integer minor units. Never floats.
export const STARTER_VIRTUAL_BALANCE_MINOR = Number(
  process.env.STARTER_VIRTUAL_BALANCE_MINOR ?? 10_000,
);

// Minimum age for any real-money entry. Varies by jurisdiction (18/19/21);
// MIN_AGE_YEARS is the floor enforced application-wide. Per-state overrides
// happen in the geo/age check pipeline. // TODO(legal)
export const MIN_AGE_YEARS = Number(process.env.MIN_AGE_YEARS ?? 21);

// Branding (safe to expose to browser via NEXT_PUBLIC_).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Rallypot";
export const TEAM_NAME = process.env.NEXT_PUBLIC_TEAM_NAME ?? "Home Team";
// Public origin (https://rallypot.org in prod). Used in email links + auth callbacks.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://rallypot.org";

// Admin allowlist by Supabase auth email. Lowercased + trimmed at compare time.
// Multiple admins comma-separated. Defaults to the project owner.
export const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS ?? "cameronoc2004@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Legacy shared-password gate. Still read so any existing admin actions that
// haven't migrated keep working; new code should use isAdmin()/requireAdmin().
// TODO(security): remove once the last reference is gone.
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

// Helper used at every real-money entry point. Centralized so legal/eng can
// reason about exactly which conditions must be true to handle cash.
export function realMoneyAllowed(): boolean {
  return REAL_MONEY_ENABLED && PERMITTED_STATES.length > 0;
}
