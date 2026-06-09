"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, ne } from "drizzle-orm";
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

  const usernameRaw = String(formData.get("username") ?? "").trim();
  // Normalize curly apostrophe → straight apostrophe so iOS autocorrect
  // (' → ’) doesn't fail validation.
  const firstName = String(formData.get("firstName") ?? "").trim().replace(/’/g, "'");
  const lastName = String(formData.get("lastName") ?? "").trim().replace(/’/g, "'");
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const line1 = String(formData.get("addressLine1") ?? "").trim();
  const line2 = String(formData.get("addressLine2") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const postalRaw = String(formData.get("postalCode") ?? "").trim();

  // Username: 3-20 chars, alphanumerics + underscore + period only. No spaces.
  if (!usernameRaw) redirect("/me/settings?error=missing_username");
  if (!/^[A-Za-z0-9._]{3,20}$/.test(usernameRaw)) {
    redirect("/me/settings?error=invalid_username");
  }
  // Real name: required, 1-50 chars, letters + spaces/hyphens/apostrophes/periods.
  if (!firstName) redirect("/me/settings?error=missing_first_name");
  if (!lastName) redirect("/me/settings?error=missing_last_name");
  // Unicode-aware. \p{L} = any letter, \p{M} = combining marks (some
  // diacritics decompose into letter + mark). Accept straight + curly
  // apostrophes since iOS autocorrects between them.
  const nameRe = /^[\p{L}\p{M}' ’.-]{1,50}$/u;
  if (!nameRe.test(firstName)) redirect("/me/settings?error=invalid_first_name");
  if (!nameRe.test(lastName)) redirect("/me/settings?error=invalid_last_name");

  // Phone: optional. If set, strip everything but digits/+ and require 10-15
  // digits after the optional leading +. We don't enforce country.
  let phone: string | null = null;
  if (phoneRaw) {
    const compact = phoneRaw.replace(/[\s()-]/g, "");
    if (!/^\+?\d{10,15}$/.test(compact)) {
      redirect("/me/settings?error=invalid_phone");
    }
    phone = compact;
  }

  // Postal code: optional, US-style 5 or 9 digits ("12345" or "12345-6789").
  let postalCode: string | null = null;
  if (postalRaw) {
    if (!/^\d{5}(-\d{4})?$/.test(postalRaw)) {
      redirect("/me/settings?error=invalid_postal");
    }
    postalCode = postalRaw;
  }

  // Uniqueness check (case-insensitive) against other profiles.
  const lower = usernameRaw.toLowerCase();
  const conflict = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.username, lower), ne(profiles.id, userId)))
    .limit(1);
  if (conflict.length > 0) redirect("/me/settings?error=username_taken");

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
        username: lower,
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
    // the explicit uniqueness check above. The DB-level UNIQUE constraints
    // on profiles.username and profiles.phone backstop it.
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("profiles_username")) redirect("/me/settings?error=username_taken");
    if (msg.includes("profiles_phone")) redirect("/me/settings?error=phone_taken");
    throw e;
  }

  await logAudit({
    actorUserId: userId,
    action: "user.update_profile",
    refType: "profile",
    refId: userId,
    payload: {
      changed: ["username", "phone", "addressLine1", "addressLine2", "city", "postalCode"],
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

  // Nullify non-cascading FKs so the delete doesn't error.
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

  // Remove the auth identity in Supabase (service role).
  try {
    const admin = getSupabaseAdmin();
    await admin.auth.admin.deleteUser(authUserId);
  } catch {
    // Already gone or admin unavailable — keep going; the session is invalid
    // anyway once we sign out below.
  }

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
