import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Handles the redirect from the email-confirmation link Supabase sends.
// The link looks like: <site>/auth/callback?code=<code>&next=/onboarding
// We exchange the code for a session, then bounce to `next` (default /onboarding).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/onboarding";

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

  return NextResponse.redirect(new URL(next, url.origin));
}
