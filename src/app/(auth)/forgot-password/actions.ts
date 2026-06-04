"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function resetRedirectUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "http://localhost:3000";
  // Same callback we use for email verification — it exchanges the code for a
  // session and bounces to `next`.
  return `${origin}/auth/callback?next=/auth/reset-password`;
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    redirect("/forgot-password?error=invalid_email");
  }

  const supabase = await createSupabaseServerClient();
  // Don't reveal whether the address exists — Supabase swallows the error
  // for unknown emails by design. We always show the "check your inbox" page.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await resetRedirectUrl(),
  });

  redirect("/forgot-password?sent=1&email=" + encodeURIComponent(email));
}
