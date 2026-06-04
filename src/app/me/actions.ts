"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { getCurrentProfileId } from "@/lib/session";
import { logAudit } from "@/db/audit";

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
