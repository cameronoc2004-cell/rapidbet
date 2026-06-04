"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function setNewPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    redirect("/auth/reset-password?error=weak");
  }
  if (password !== confirm) {
    redirect("/auth/reset-password?error=mismatch");
  }

  const supabase = await createSupabaseServerClient();
  // Recovery flow: by the time we get here, /auth/callback has exchanged the
  // email-link code for a session with the recovery scope. updateUser sets
  // the new password against that session.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.message?.toLowerCase().includes("session")) {
      redirect("/forgot-password?error=invalid_email");
    }
    redirect("/auth/reset-password?error=failed");
  }

  redirect("/me?ok=password_updated");
}
