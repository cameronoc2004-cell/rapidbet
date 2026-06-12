"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
import { normalizePhone } from "@/lib/phone";
import { db } from "@/db/client";
import { auditLogs, profiles, questions, settlements } from "@/db/schema";
import { getCurrentProfileId, getCurrentSession } from "@/lib/session";
import { logAudit } from "@/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Edit username + contact info. Validates each field; an empty/whitespace
// value clears the optional fields (phone/address) so the user can wipe
// data they previously entered.
//
// Username is uniqueness-checked case-insensitively against other profiles.
// Email + DOB + state are intentionally NOT here: email changes through
// Supabase Auth, DOB is fixed once the user proves age (would let users
// circumvent the age gate), state is GPS-verified.
export async function updateProfile(formData: FormData) {
  const userId = await getCurrentProfileId();
  if (!userId) redirect("/login");

  // Normalize curly apostrophe → straight apostrophe so iOS autocorrect
  // (' → ’) doesn't fail validation.
  const firstName = String(formData.get("firstName") ?? "").trim().replace(/’/g, "'");
  const lastName = String(formData.get("lastName") ?? "").trim().replace(/’/g, "'");
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const line1 = String(formData.get("addressLine1") ?? "").trim();
  const line2 = String(formData.get("addressLine2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const postalRaw = String(formData.get("postalCode") ?? "").trim();

  // Real name: required, 1-50 chars, letters + spaces/hyphens/apostrophes/periods.
  if (!firstName) redirect("/me/settings?error=missing_first_name");
  if (!lastName) redirect("/me/settings?error=missing_last_name");
  // Unicode-aware. \p{L} = any letter, \p{M} = combining marks (some
  // diacritics decompose into letter + mark). Accept straight + curly
  // apostrophes since iOS autocorrects between them.
  const nameRe = /^[\p{L}\p{M}' ’.-]{1,50}$/u;
  if (!nameRe.test(firstName)) redirect("/me/settings?error=invalid_first_name");
  if (!nameRe.test(lastName)) redirect("/me/settings?error=invalid_last_name");

  // Phone: optional. Canonicalized to digits-only with US country code
  // stripped (see src/lib/phone.ts) so uniqueness can't be bypassed by
  // formatting variations.
  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalizePhone(phoneRaw);
    if (!phone) redirect("/me/settings?error=invalid_phone");
  }

  // Postal code: optional, US-style 5 or 9 digits ("12345" or "12345-6789").
  let postalCode: string | null = null;
  if (postalRaw) {
    if (!/^\d{5}(-\d{4})?$/.test(postalRaw)) {
      redirect("/me/settings?error=invalid_postal");
    }
    postalCode = postalRaw;
  }

  // Phone uniqueness: one phone per account, ever. Compared on the canonical
  // (digits-only / + prefix) string so "+1 555 1234" and "+15551234" collide.
  if (phone) {
    const phoneClash = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(eq(profiles.phone, phone), ne(profiles.id, userId)))
      .limit(1);
    if (phoneClash.length > 0) redirect("/me/settings?error=phone_taken");
  }

  try {
    await db
      .update(profiles)
      .set({
        firstName,
        lastName,
        phone,
        addressLine1: line1 || null,
        addressLine2: line2 || null,
        city: city || null,
        postalCode,
      })
      .where(eq(profiles.id, userId));
  } catch (e) {
    // Race condition belt-and-suspenders: a concurrent save could slip past
    // the explicit uniqueness check above. The DB-level UNIQUE constraint
    // on profiles.phone backstops it.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("profiles_phone")) redirect("/me/settings?error=phone_taken");
    throw e;
  }

  await logAudit({
    actorUserId: userId,
    action: "user.update_profile",
    refType: "profile",
    refId: userId,
    payload: {
      changed: ["firstName", "lastName", "phone", "addressLine1", "addressLine2", "city", "postalCode"],
    },
  });

  revalidatePath("/me");
  revalidatePath("/me/settings");
  redirect("/me/settings?ok=updated");
}

export async function updateNotificationPrefs(formData: FormData) {
  const userId = await getCurrentProfileId();
  if (!userId) redirect("/login");

  // Checkboxes only show up in FormData when checked, so absence == false.
  const notifyEmail = formData.get("notifyEmail") === "on";
  const notifyPush = formData.get("notifyPush") === "on";

  await db
    .update(profiles)
    .set({ notifyEmail, notifyPush })
    .where(eq(profiles.id, userId));

  await logAudit({
    actorUserId: userId,
    action: "user.update_notification_prefs",
    refType: "profile",
    refId: userId,
    payload: { notifyEmail, notifyPush },
  });

  revalidatePath("/me");
  redirect("/me?ok=notif_prefs");
}

// Permanently delete the signed-in user's account and ALL their data.
// FK rules in the schema:
//   - profile-owned tables (wallets, ledger_entries, entries, kyc_records,
//     geo_checks, responsible_gaming_limits, self_exclusions, device_tokens,
//     payment_orders, skill_scores) cascade DELETE on profile delete.
//   - audit_logs.actorUserId / questions.createdBy / settlements.resolvedBy
//     are nullable references that do NOT cascade — we nullify them first so
//     event/contest history survives for other users.
// Then we delete the Supabase auth.users row and sign out. The audit row for
// the deletion itself is written first so we keep an immutable trail.
export async function deleteAccount() {
  const session = await getCurrentSession();
  if (!session?.profile) redirect("/login");

  const userId = session.profile.id;
  const authUserId = session.profile.authUserId;

  await logAudit({
    actorUserId: userId,
    action: "user.delete_account",
    refType: "profile",
    refId: userId,
    payload: {
      username: session.profile.username,
      email: session.authUser.email ?? null,
    },
  });

  // Remove the auth identity in Supabase FIRST, before we touch our DB.
  // The previous implementation deleted our profile row, then tried to
  // delete the auth.users row in a silent try/catch — if the auth deletion
  // failed (bad service-role key, network, etc.) we never knew and the
  // user was left orphaned in Supabase. Now: if auth deletion fails we
  // log loudly to both console and audit_logs, and we still proceed with
  // local cleanup + sign-out so the user isn't stuck. The orphan auth
  // record can be swept by scripts/clear-auth-orphans.ts later.
  let authDeleted = false;
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(authUserId);
    if (error) throw error;
    authDeleted = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      "[delete_account] supabase auth.admin.deleteUser failed:",
      JSON.stringify({ authUserId, userId, error: msg }),
    );
    await logAudit({
      actorUserId: userId,
      action: "user.delete_account.auth_failed",
      refType: "profile",
      refId: userId,
      payload: { authUserId, error: msg },
    });
  }

  // Nullify non-cascading FKs so the profile delete doesn't error.
  await db
    .update(auditLogs)
    .set({ actorUserId: null })
    .where(eq(auditLogs.actorUserId, userId));
  await db
    .update(questions)
    .set({ createdBy: null })
    .where(eq(questions.createdBy, userId));
  await db
    .update(settlements)
    .set({ resolvedBy: null })
    .where(eq(settlements.resolvedBy, userId));

  // Cascade-delete everything owned by this profile.
  await db.delete(profiles).where(eq(profiles.id, userId));

  void authDeleted; // referenced for future telemetry; intentionally unused for now

  // Drop the session cookies. Once admin.deleteUser succeeded, the JWT is
  // already invalid server-side; signOut() can still raise on the network
  // round-trip. We catch + fall through to an explicit cookie wipe so a
  // failed signOut never leaves the browser with stale auth state.
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch {
    // ignore — cookie wipe below handles it
  }
  const cookieStore = await cookies();
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-") || c.name.includes("supabase")) {
      cookieStore.delete(c.name);
    }
  }

  // Sign-up tab, not sign-in — a user who just deleted their account is
  // overwhelmingly more likely to want a fresh start than to re-enter the
  // credentials of an account that no longer exists.
  redirect("/login?mode=signup&deleted=1");
}
