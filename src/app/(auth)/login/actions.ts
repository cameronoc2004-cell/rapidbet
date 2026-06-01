"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { postTransaction } from "@/db/ledger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNUP_GC_BONUS, SIGNUP_SC_BONUS } from "@/lib/config";

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
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

  // Username uniqueness — check before calling Supabase to avoid orphan auth users.
  const taken = await db
    .select()
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);
  if (taken.length > 0) {
    redirect("/login?mode=signup&error=username_taken");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) {
    const code = error?.message?.includes("already") ? "email_taken" : "signup_failed";
    redirect(`/login?mode=signup&error=${code}`);
  }

  // Create profile + seed starter balances atomically.
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(profiles)
      .values({ authUserId: data.user!.id, username })
      .returning();
    if (SIGNUP_GC_BONUS > 0) {
      await postTransaction(
        { userId: created.id, currency: "GC", delta: SIGNUP_GC_BONUS, reason: "signup_bonus" },
        tx,
      );
    }
    if (SIGNUP_SC_BONUS > 0) {
      await postTransaction(
        { userId: created.id, currency: "SC", delta: SIGNUP_SC_BONUS, reason: "signup_bonus" },
        tx,
      );
    }
  });

  redirect("/");
}

export async function signIn(formData: FormData) {
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/login?error=bad_credentials");
  }
  redirect("/");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
