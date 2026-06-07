import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handles the redirect from the email-confirmation link Supabase sends.
// Link: <site>/auth/callback?code=<code>&next=/auth/confirmed
//
// Flow:
// 1. Exchange the code for a session — this is what flips
//    auth.users.email_confirmed_at to a timestamp.
// 2. If next=/auth/confirmed (the signup-confirmation path), sign the user
//    back out so they land on the success page logged-out and have to enter
//    credentials on /login to continue. Clear handoff, no surprise auto-
//    sign-in from a different browser/device than they signed up on.
// 3. Other flows (password reset → /auth/reset-password) keep the session.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/auth/confirmed";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent("verify_failed")}`, url.origin),
    );
  }

  if (next === "/auth/confirmed") {
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
