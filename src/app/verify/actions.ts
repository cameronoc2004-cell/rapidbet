"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { logAudit } from "@/db/audit";
import { getCurrentSession } from "@/lib/session";
import { kyc } from "@/lib/services";

// Kick off a Didit "Get Verified" session. Creates a row in kyc_records via
// the KYC adapter, then redirects the user to Didit's hosted UI.
//
// The webhook handler (POST /api/webhooks/didit) flips the row to verified /
// rejected / expired when Didit reaches a decision.
export async function startVerification() {
  const session = await getCurrentSession();
  if (!session?.profile) redirect("/login");
  const email = session.authUser?.email ?? "";

  const { hostedUrl } = await kyc.createSession({
    userId: session.profile.id,
    email,
  });

  await logAudit({
    actorUserId: session.profile.id,
    action: "kyc.session.create",
    refType: "profile",
    refId: session.profile.id,
    payload: { vendor: "didit" },
  });

  // Hard redirect off-site to Didit's hosted verification UI. After the user
  // completes (or abandons), Didit redirects back to NEXT_PUBLIC_APP_URL/me.
  redirect(hostedUrl);
}

// "Skip for now" — suppresses the post-onboarding modal without unlocking
// contest entry. The user can still re-trigger from /me.
export async function dismissVerificationPrompt() {
  const session = await getCurrentSession();
  if (!session?.profile) redirect("/login");

  await db
    .update(profiles)
    .set({ kycPromptDismissedAt: new Date() })
    .where(eq(profiles.id, session.profile.id));

  await logAudit({
    actorUserId: session.profile.id,
    action: "kyc.prompt.dismiss",
    refType: "profile",
    refId: session.profile.id,
  });

  revalidatePath("/");
  revalidatePath("/me");
}
