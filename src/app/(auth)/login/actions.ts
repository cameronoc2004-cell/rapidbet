"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, wallets } from "@/db/schema";
import { postWalletTx } from "@/db/wallet";
import { logAudit } from "@/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STARTER_VIRTUAL_BALANCE_MINOR } from "@/lib/config";

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Build the absolute URL we want Supabase to send the user back to after they
// click the confirmation link. Includes /auth/callback?next=/onboarding so the
// route handler exchanges the code and routes them into the gates flow.
async function emailCallbackUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "http://localhost:3000";
  return `${origin}/auth/callback?next=/onboarding`;
}

export async function signUp(formData: FormData) {
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password");
  const username = field(formData, "username").toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    redirect("/login?mode=signup&error=invalid_username");
  }
  if (password.length < 8) {
    redirect("/login?mode=signup&error=weak_password");
  }
  if (!email.includes("@")) {
    redirect("/login?mode=signup&error=invalid_email");
  }

  const taken = await db
    .select()
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);
  if (taken.length > 0) {
    redirect("/login?mode=signup&error=username_taken");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await emailCallbackUrl(),
      // Username is stashed in user_metadata so we can use it after they verify
      // even before they hit any of our endpoints again. We also create the
      // profile row immediately below if signUp returns a user (it always does;
      // session may or may not be created depending on Confirm Email setting).
      data: { username },
    },
  });
  if (error || !data.user) {
    const code = error?.message?.includes("already") ? "email_taken" : "signup_failed";
    redirect(`/login?mode=signup&error=${code}`);
  }

  // Provision profile + wallet + signup bonus eagerly. If the user never
  // verifies their email, this row sits unused (cheap). If they do verify,
  // we have a profile waiting and don't race with the email-callback handler.
  await db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.authUserId, data.user!.id))
      .limit(1);
    if (existing.length > 0) return; // idempotent

    const [created] = await tx
      .insert(profiles)
      .values({ authUserId: data.user!.id, username })
      .returning();
    await tx.insert(wallets).values({ userId: created.id });
    if (STARTER_VIRTUAL_BALANCE_MINOR > 0) {
      await postWalletTx(
        {
          userId: created.id,
          moneyKind: "virtual",
          deltaMinor: STARTER_VIRTUAL_BALANCE_MINOR,
          reason: "signup_bonus",
          idempotencyKey: `signup_bonus:${created.id}`,
        },
        tx,
      );
    }
    await logAudit(
      {
        actorUserId: created.id,
        action: "user.signup",
        refType: "profile",
        refId: created.id,
        payload: { email, username },
      },
      tx,
    );
  });

  // Whether or not Supabase auto-created a session depends on the "Confirm
  // email" project setting. Either way, route them to the check-email
  // interstitial; if they're already signed in, the page itself will pick the
  // right copy and CTA.
  redirect("/login?mode=verify&email=" + encodeURIComponent(email));
}

export async function signIn(formData: FormData) {
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Supabase returns the same message for both "invalid creds" and
    // "email not confirmed" depending on settings; route the latter to a clearer state.
    if (error.message?.toLowerCase().includes("confirm")) {
      redirect("/login?mode=verify&email=" + encodeURIComponent(email));
    }
    redirect("/login?error=bad_credentials");
  }
  redirect("/");
}

export async function resendVerification(formData: FormData) {
  const email = field(formData, "email").toLowerCase();
  if (!email.includes("@")) {
    redirect("/login?mode=verify&error=invalid_email");
  }
  const supabase = await createSupabaseServerClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: await emailCallbackUrl() },
  });
  redirect("/login?mode=verify&email=" + encodeURIComponent(email) + "&resent=1");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
