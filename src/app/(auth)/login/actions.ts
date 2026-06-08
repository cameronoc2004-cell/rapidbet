"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, wallets } from "@/db/schema";
import { genesisCredit } from "@/lib/ledger-ops";
import { logAudit } from "@/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { STARTER_VIRTUAL_BALANCE_MINOR } from "@/lib/config";

function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

// Build the absolute URL we want Supabase to send the user back to after they
// click the confirmation link. Includes /auth/callback?next=/auth/confirmed
// so the route handler exchanges the code (which is what actually flips
// email_confirmed_at), signs them back out, and lands them on a static
// "your email is confirmed" page with a "Back to the app" CTA.
async function emailCallbackUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "http://localhost:3000";
  return `${origin}/auth/callback?next=/auth/confirmed`;
}

// Slightly stricter than HTML5 type="email": requires a TLD of 2+ letters,
// no leading/trailing dots in the local part, no whitespace. Catches typos
// that would otherwise burn a Supabase rate-limit slot.
const EMAIL_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/;

// Real-name fields: letters from any script, combining marks (accents),
// straight + curly apostrophes (iOS autocorrects ' → ’ silently — the
// previous regex rejected curly quotes so names like "O'Connell" appeared
// invalid after autocorrect), spaces, periods, hyphens. No digits, no
// underscores.
const NAME_RE = /^[\p{L}\p{M}' ’.-]{1,50}$/u;

// Username: 3–20 chars, alphanumerics + underscore + period only. Same shape
// as /me/settings updateProfile so the constraint is identical across the
// surface area where a user can choose one.
const USERNAME_RE = /^[A-Za-z0-9._]{3,20}$/;

// Phone: digits, optional + prefix, 10–15 digits after strip. Same shape as
// updateProfile validation.
function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const compact = raw.replace(/[\s()-]/g, "");
  if (!/^\+?\d{10,15}$/.test(compact)) return null;
  return compact;
}

// Normalize curly apostrophes to straight ones so the DB has one canonical
// form regardless of which keyboard typed it.
function normalizeName(s: string): string {
  return s.replace(/’/g, "'");
}

export async function signUp(formData: FormData) {
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password");
  const confirmPassword = field(formData, "confirmPassword");
  const firstName = normalizeName(field(formData, "firstName"));
  const lastName = normalizeName(field(formData, "lastName"));
  const usernameRaw = field(formData, "username");
  const phoneRaw = field(formData, "phone");
  // Required: checkbox must be checked. Browsers only send "on" when checked.
  const termsAccepted = formData.get("acceptTerms") === "on";

  if (!termsAccepted) {
    redirect("/login?mode=signup&error=terms_required");
  }
  if (!firstName) redirect("/login?mode=signup&error=missing_first_name");
  if (!lastName) redirect("/login?mode=signup&error=missing_last_name");
  if (!NAME_RE.test(firstName)) redirect("/login?mode=signup&error=invalid_first_name");
  if (!NAME_RE.test(lastName)) redirect("/login?mode=signup&error=invalid_last_name");
  if (!usernameRaw) redirect("/login?mode=signup&error=missing_username");
  if (!USERNAME_RE.test(usernameRaw)) {
    redirect("/login?mode=signup&error=invalid_username");
  }
  if (!EMAIL_RE.test(email)) {
    redirect("/login?mode=signup&error=invalid_email");
  }
  if (password.length < 8) {
    redirect("/login?mode=signup&error=weak_password");
  }
  if (password !== confirmPassword) {
    redirect("/login?mode=signup&error=password_mismatch");
  }

  // Phone is optional, but if provided must pass the same shape check used
  // on /me/settings so the DB never sees an invalid value.
  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalizePhone(phoneRaw);
    if (!phone) redirect("/login?mode=signup&error=invalid_phone");
  }

  // Username uniqueness: case-insensitive. We lowercase before checking and
  // store lowercase to avoid display drift.
  const username = usernameRaw.toLowerCase();
  const usernameTaken = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);
  if (usernameTaken.length > 0) {
    redirect("/login?mode=signup&error=username_taken");
  }

  // Phone uniqueness: one phone per account. Checked here so the user gets
  // a clear error before the Supabase signUp burns a rate-limit slot.
  if (phone) {
    const phoneTaken = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.phone, phone))
      .limit(1);
    if (phoneTaken.length > 0) redirect("/login?mode=signup&error=phone_taken");
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
    // Log the *actual* Supabase reason — past iterations silently bucketed
    // every non-"already exists" failure into a useless generic banner.
    // Common ones we surface explicitly:
    //   - rate_limited:    Supabase email throttle hit (default 30/hr).
    //   - smtp_failure:    custom SMTP rejected the confirmation send.
    //   - signups_disabled: Auth settings have signups turned off.
    //   - email_taken:     account already exists.
    console.error(
      "[signup] supabase.auth.signUp failed:",
      JSON.stringify({ email, error: error?.message, status: error?.status }),
    );
    const msg = (error?.message ?? "").toLowerCase();
    let code = "signup_failed";
    if (msg.includes("already")) code = "email_taken";
    else if (msg.includes("rate") || msg.includes("for security")) code = "rate_limited";
    else if (msg.includes("smtp") || msg.includes("sending") || msg.includes("confirmation"))
      code = "smtp_failure";
    else if (msg.includes("disabled")) code = "signups_disabled";
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
      .values({
        authUserId: data.user!.id,
        username,
        firstName,
        lastName,
        phone,
        termsAcceptedAt: new Date(),
      })
      .returning();
    await tx.insert(wallets).values({ userId: created.id });
    if (STARTER_VIRTUAL_BALANCE_MINOR > 0) {
      await genesisCredit(
        {
          userId: created.id,
          amountMinor: STARTER_VIRTUAL_BALANCE_MINOR,
          moneyKind: "virtual",
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
