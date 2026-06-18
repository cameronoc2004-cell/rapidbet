import { desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db/client";
import { kycRecords, profiles } from "@/db/schema";
import { createSupabaseServerClient } from "./supabase/server";
import { PLAY_MIN_AGE_YEARS, PLAY_PERMITTED_STATES } from "./config";
import { isAdminAuthed } from "./admin-auth";

export interface OnboardingStatus {
  emailVerified: boolean;
  ageVerified: boolean;
  stateVerified: boolean;
  // True iff every gate above is satisfied AND profiles.onboardedAt is set.
  complete: boolean;
}

// Auth helper: returns the Supabase auth.users row (with email_confirmed_at)
// alongside our app-side profile, or null if not signed in.
export async function getCurrentSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const rows = await db.select().from(profiles).where(eq(profiles.authUserId, user.id)).limit(1);
  return { authUser: user, profile: rows[0] ?? null };
}

export async function getCurrentProfile() {
  const s = await getCurrentSession();
  return s?.profile ?? null;
}

export async function getCurrentProfileId(): Promise<number | null> {
  const p = await getCurrentProfile();
  return p?.id ?? null;
}

// Compute the gate status from an already-fetched session.
export function getOnboardingStatus(session: Awaited<ReturnType<typeof getCurrentSession>>): OnboardingStatus {
  if (!session) {
    return { emailVerified: false, ageVerified: false, stateVerified: false, complete: false };
  }
  const { authUser, profile } = session;
  const emailVerified = Boolean(authUser?.email_confirmed_at);
  const ageVerified = !!profile?.dateOfBirth && computeAgeYears(profile.dateOfBirth) >= PLAY_MIN_AGE_YEARS;
  const stateVerified =
    !!profile?.stateCode && PLAY_PERMITTED_STATES.includes(profile.stateCode.toUpperCase());
  const complete = !!profile?.onboardedAt && emailVerified && ageVerified && stateVerified;
  return { emailVerified, ageVerified, stateVerified, complete };
}

// Gate any page that requires a fully onboarded user.
// - No session → /login
// - Session but onboarding incomplete → /onboarding
// Returns the session if it passes.
export async function requireOnboarded() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  const status = getOnboardingStatus(session);
  if (!status.complete) redirect("/onboarding");
  return session;
}

// Verification ("Get Verified") status, derived from kyc_records.
//
// Returns the most-recent kyc_records row's status for the profile, plus a
// `promptDismissed` flag from profiles.kycPromptDismissedAt.
//
// Status values map to user-facing copy:
//   verified -> "Verified" — can enter contests
//   pending  -> "In review" — waiting on Didit decision
//   rejected -> "Failed verification" — must retry
//   expired  -> "Expired" — must re-verify
//   none     -> "Not verified" — never started
export interface VerificationStatus {
  status: "verified" | "pending" | "rejected" | "expired" | "none";
  promptDismissed: boolean;
}

export async function getVerificationStatus(profileId: number): Promise<VerificationStatus> {
  const [profile] = await db
    .select({ dismissedAt: profiles.kycPromptDismissedAt })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  const promptDismissed = !!profile?.dismissedAt;

  const [latest] = await db
    .select({ status: kycRecords.status })
    .from(kycRecords)
    .where(eq(kycRecords.userId, profileId))
    .orderBy(desc(kycRecords.createdAt))
    .limit(1);
  const status = (latest?.status ?? "none") as VerificationStatus["status"];
  return { status, promptDismissed };
}

// Used by /onboarding itself: needs auth but onboarding may be incomplete.
export async function requireSession() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}

// Admin gate. Admin is a SEPARATE auth system from consumer accounts — a signed
// cookie set by the /admin/login passcode flow (see lib/admin-auth.ts), not the
// Supabase session. These thin wrappers keep the existing call sites working.
export async function isAdmin(): Promise<boolean> {
  return isAdminAuthed();
}

// Use on admin ACTIONS. 404 (not 401/redirect) on miss so the route is
// undiscoverable to anyone who isn't an admin.
export async function requireAdmin() {
  if (!(await isAdminAuthed())) notFound();
}

// Use on admin PAGES — sends non-admins to the dedicated admin sign-in rather
// than 404, so a signed-out admin can actually log in.
export async function requireAdminOrLogin() {
  if (!(await isAdminAuthed())) redirect("/admin/login");
}

export function computeAgeYears(isoDob: string): number {
  // isoDob = yyyy-mm-dd
  const [y, m, d] = isoDob.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const today = new Date();
  let age = today.getUTCFullYear() - y;
  const beforeBirthday =
    today.getUTCMonth() + 1 < m ||
    (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}
