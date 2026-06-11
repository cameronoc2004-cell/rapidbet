-- =============================================================================
-- Row Level Security policies for Rapid Bet.
--
-- HOW TO APPLY (one-time):
--   1) Open Supabase Dashboard → SQL Editor → New query
--   2) Paste this entire file → Run
--
-- The Postgres `postgres` role (used by our server via DATABASE_URL) and the
-- Supabase `service_role` key bypass RLS by design — so server code keeps full
-- access. RLS protects against accidental client-side data access via the
-- anon/publishable key.
--
-- Safe to re-run: every CREATE POLICY is wrapped in DROP IF EXISTS first.
-- =============================================================================

-- =====================
-- Enable RLS everywhere
-- =====================
ALTER TABLE profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries              ENABLE ROW LEVEL SECURITY;
ALTER TABLE games                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_scores                ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_records                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_checks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsible_gaming_limits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_exclusions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens               ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders              ENABLE ROW LEVEL SECURITY;
-- Ledger internals — server-only. RLS enabled with NO policies, so the anon
-- key cannot touch these tables at all. The server's `postgres` role
-- bypasses RLS and keeps full access for the ledger engine.
ALTER TABLE accounts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE postings                    ENABLE ROW LEVEL SECURITY;

-- =====================
-- Helper: maps auth.uid() (uuid) -> profiles.id (int)
-- =====================
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()
$$;

-- =====================
-- profiles: read own + update own non-sensitive fields. No client INSERT/DELETE.
-- =====================
DROP POLICY IF EXISTS profiles_select_own  ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- =====================
-- Wallet + ledger: read own only. Mutations are server-only (service_role).
-- =====================
DROP POLICY IF EXISTS wallets_select_own ON wallets;
CREATE POLICY wallets_select_own ON wallets
  FOR SELECT TO authenticated
  USING (user_id = current_profile_id());

DROP POLICY IF EXISTS ledger_select_own ON ledger_entries;
CREATE POLICY ledger_select_own ON ledger_entries
  FOR SELECT TO authenticated
  USING (user_id = current_profile_id());

-- =====================
-- Games + questions + settlements: public read (these are not private data).
-- =====================
DROP POLICY IF EXISTS games_select_all ON games;
CREATE POLICY games_select_all ON games FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS questions_select_all ON questions;
CREATE POLICY questions_select_all ON questions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS settlements_select_all ON settlements;
CREATE POLICY settlements_select_all ON settlements FOR SELECT TO authenticated USING (true);

-- =====================
-- Entries: read own + read others' entries on questions you've entered (for
-- pool transparency). Insert is server-only — the contest engine handles it.
-- =====================
DROP POLICY IF EXISTS entries_select_own ON entries;
CREATE POLICY entries_select_own ON entries
  FOR SELECT TO authenticated
  USING (
    user_id = current_profile_id()
    OR question_id IN (
      SELECT question_id FROM entries WHERE user_id = current_profile_id()
    )
  );

-- =====================
-- Skill scores: read own + leaderboard reads (public).
-- =====================
DROP POLICY IF EXISTS skill_select_all ON skill_scores;
CREATE POLICY skill_select_all ON skill_scores FOR SELECT TO authenticated USING (true);

-- =====================
-- KYC, geo checks, RG limits, self exclusions: read own only. Server-only writes.
-- =====================
DROP POLICY IF EXISTS kyc_select_own ON kyc_records;
CREATE POLICY kyc_select_own ON kyc_records
  FOR SELECT TO authenticated USING (user_id = current_profile_id());

DROP POLICY IF EXISTS geo_select_own ON geo_checks;
CREATE POLICY geo_select_own ON geo_checks
  FOR SELECT TO authenticated USING (user_id = current_profile_id());

DROP POLICY IF EXISTS rg_select_own ON responsible_gaming_limits;
CREATE POLICY rg_select_own ON responsible_gaming_limits
  FOR SELECT TO authenticated USING (user_id = current_profile_id());

DROP POLICY IF EXISTS rg_update_own ON responsible_gaming_limits;
CREATE POLICY rg_update_own ON responsible_gaming_limits
  FOR UPDATE TO authenticated USING (user_id = current_profile_id());

DROP POLICY IF EXISTS rg_insert_own ON responsible_gaming_limits;
CREATE POLICY rg_insert_own ON responsible_gaming_limits
  FOR INSERT TO authenticated WITH CHECK (user_id = current_profile_id());

DROP POLICY IF EXISTS se_select_own ON self_exclusions;
CREATE POLICY se_select_own ON self_exclusions
  FOR SELECT TO authenticated USING (user_id = current_profile_id());

-- =====================
-- Audit logs: own actions only. Server inserts everything.
-- =====================
DROP POLICY IF EXISTS audit_select_own ON audit_logs;
CREATE POLICY audit_select_own ON audit_logs
  FOR SELECT TO authenticated USING (actor_user_id = current_profile_id());

-- =====================
-- Device tokens: read + insert + delete OWN tokens (clients register from browser).
-- Server still owns the send path.
-- =====================
DROP POLICY IF EXISTS dt_select_own ON device_tokens;
CREATE POLICY dt_select_own ON device_tokens
  FOR SELECT TO authenticated USING (user_id = current_profile_id());

DROP POLICY IF EXISTS dt_insert_own ON device_tokens;
CREATE POLICY dt_insert_own ON device_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = current_profile_id());

DROP POLICY IF EXISTS dt_delete_own ON device_tokens;
CREATE POLICY dt_delete_own ON device_tokens
  FOR DELETE TO authenticated USING (user_id = current_profile_id());

-- =====================
-- Payment orders: read own only. Mutations are server-only (Trustly webhook).
-- =====================
DROP POLICY IF EXISTS po_select_own ON payment_orders;
CREATE POLICY po_select_own ON payment_orders
  FOR SELECT TO authenticated USING (user_id = current_profile_id());
