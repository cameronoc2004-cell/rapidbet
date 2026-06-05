"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, profiles, questions, settlements } from "@/db/schema";
import { getCurrentProfileId, getCurrentSession } from "@/lib/session";
import { logAudit } from "@/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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

  // Drop the session cookies.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  redirect("/login?deleted=1");
}
