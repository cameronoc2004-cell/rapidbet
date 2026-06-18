"use server";

import { redirect } from "next/navigation";
import {
  verifyAdminCredentials,
  setAdminSession,
  clearAdminSession,
} from "@/lib/admin-auth";

// Admin sign-in: email + the universal passcode. Both must be correct — the
// email must be on the Vercel ADMIN_EMAILS allowlist AND the passcode must
// match ADMIN_PASSCODE. Either wrong → no entry, with a single generic error
// so we don't reveal which part failed. No sign-up exists.
export async function adminSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const passcode = String(formData.get("passcode") ?? "");

  if (!verifyAdminCredentials(email, passcode)) {
    redirect("/admin/login?error=denied");
  }
  await setAdminSession(email);
  redirect("/admin");
}

export async function adminSignOut() {
  await clearAdminSession();
  redirect("/admin/login");
}
