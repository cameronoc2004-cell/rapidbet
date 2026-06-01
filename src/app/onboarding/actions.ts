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
import { PLAY_MIN_AGE_YEARS } from "@/lib/config";
import { geoProvider } from "@/lib/providers/geo";

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

// Verify the user's location via device GPS (forwarded from the browser).
// This is the ONLY path that can set profile.stateCode — no self-reported
// values are accepted. Every attempt is logged to geo_checks.
//
// Throws on failure so the client can display the specific reason inline.
export async function verifyLocation(formData: FormData): Promise<void> {
  const session = await requireSignedInProfile();
  const lat = Number(formData.get("latitude"));
  const lng = Number(formData.get("longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error("invalid_coords");
  }

  const result = await geoProvider.check({
    userId: session.profile!.id,
    latitude: lat,
    longitude: lng,
  });

  if (result.result !== "permitted") {
    await logAudit({
      actorUserId: session.profile!.id,
      action: "onboarding.geo_blocked",
      refType: "geo_check",
      refId: result.geoCheckId,
      payload: { stateCode: result.stateCode, reason: result.blockReason },
    });
    // Translate to a stable error code the client can map to copy.
    throw new Error(result.blockReason ?? "outside_permitted_state");
  }

  await db
    .update(profiles)
    .set({ stateCode: result.stateCode! })
    .where(eq(profiles.id, session.profile!.id));
  await logAudit({
    actorUserId: session.profile!.id,
    action: "onboarding.geo_verified",
    refType: "geo_check",
    refId: result.geoCheckId,
    payload: { stateCode: result.stateCode },
  });
  await maybeMarkOnboarded(session.profile!.id);
  revalidatePath("/onboarding");
  revalidatePath("/me");
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
