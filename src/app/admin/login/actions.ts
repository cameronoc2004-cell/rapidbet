"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/config";

// Is this authenticated user an admin? Owner bootstrap via env, plus any
// Supabase auth user whose app_metadata.role === "admin" (set in the dashboard,
// not user-editable). Mirrors sessionIsAdmin in lib/session.ts.
function userIsAdmin(email: string, appMetadata: unknown): boolean {
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return true;
  return (appMetadata as { role?: string } | undefined)?.role === "admin";
}

// Dedicated admin sign-in. There is intentionally NO sign-up — admin accounts
// are created manually in Supabase. A non-admin who somehow knows valid
// credentials is signed straight back out and never gets an admin session.
export async function adminSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    redirect("/admin/login?error=bad_credentials");
  }
  if (!userIsAdmin(email, data.user.app_metadata)) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not_authorized");
  }
  redirect("/admin");
}

export async function adminSignOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
