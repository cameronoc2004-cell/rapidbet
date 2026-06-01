"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { logAudit } from "@/db/audit";
import {
  computeAgeYears,
  getCurrentSession,
  getOnboardingStatus,
} from "@/lib/session";
import { PLAY_MIN_AGE_YEARS, PLAY_PERMITTED_STATES } from "@/lib/config";

async function requireSignedInProfile() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/login");
  return session;
}

export async function submitDateOfBirth(formData: FormData) {
  const session = await requireSignedInProfile();
  const dob = String(formData.get("dob") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    redirect("/onboarding?error=invalid_dob");
  }
  const age = computeAgeYears(dob);
  if (age < PLAY_MIN_AGE_YEARS) {
    redirect("/onboarding?error=underage");
  }
  await db
    .update(profiles)
    .set({ dateOfBirth: dob })
    .where(eq(profiles.id, session.profile!.id));
  await logAudit({
    actorUserId: session.profile!.id,
    action: "onboarding.dob_set",
    refType: "profile",
    refId: session.profile!.id,
    payload: { age },
  });
  await maybeMarkOnboarded(session.profile!.id);
  revalidatePath("/onboarding");
  revalidatePath("/me");
  redirect("/onboarding");
}

export async function submitState(formData: FormData) {
  const session = await requireSignedInProfile();
  const code = String(formData.get("stateCode") ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) redirect("/onboarding?error=invalid_state");
  if (!PLAY_PERMITTED_STATES.includes(code)) {
    redirect("/onboarding?error=state_blocked");
  }
  await db
    .update(profiles)
    .set({ stateCode: code })
    .where(eq(profiles.id, session.profile!.id));
  await logAudit({
    actorUserId: session.profile!.id,
    action: "onboarding.state_set",
    refType: "profile",
    refId: session.profile!.id,
    payload: { stateCode: code },
  });
  await maybeMarkOnboarded(session.profile!.id);
  revalidatePath("/onboarding");
  revalidatePath("/me");
  redirect("/onboarding");
}

// If all three gates are satisfied, set onboardedAt. This is the single point
// where the gate flips closed → open.
async function maybeMarkOnboarded(profileId: number) {
  const fresh = await getCurrentSession();
  if (!fresh) return;
  const status = getOnboardingStatus(fresh);
  if (status.emailVerified && status.ageVerified && status.stateVerified) {
    await db
      .update(profiles)
      .set({ onboardedAt: new Date() })
      .where(eq(profiles.id, profileId));
    await logAudit({
      actorUserId: profileId,
      action: "onboarding.complete",
      refType: "profile",
      refId: profileId,
    });
  }
}
