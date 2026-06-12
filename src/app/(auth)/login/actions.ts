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

// Derive a unique username from the email's local part. Strip non-allowed
// chars, pad to 3+ chars if needed, suffix _2, _3, … on collision. Users
// don't pick a username at signup any more — they can change it later from
// /me/settings if they want something other than the auto-derived one.
async function deriveUniqueUsername(email: string): Promise<string> {
  const base = (email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 17) || "user";
  const padded = base.length < 3 ? (base + "user").slice(0, 6) : base;
  let candidate = padded;
  for (let n = 2; n < 1000; n++) {
    const taken = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.username, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
    candidate = `${padded.slice(0, 17)}_${n}`;
  }
  // Hard fallback: random suffix. We've exhausted 1..999 collisions on this
  // email's base — overwhelmingly improbable, but make sure we don't loop.
  return `${padded}_${Math.random().toString(36).slice(2, 6)}`;
}

// Normalize curly apostrophes to straight ones so the DB has one canonical
// form regardless of which keyboard typed it.
function normalizeName(s: string): string {
  return s.replace(/’/g, "'");
}

// Per-call state shape: error code + the user's typed values so the client
// form can re-render with everything they entered preserved. The field
// that triggered the error is intentionally absent from `values` so it
// re-renders blank — the user only re-types what they got wrong, not the
// whole form. Passwords are NEVER round-tripped (security + browsers
// generally ignore defaultValue on password inputs anyway); the client
// clears both password fields on any error.
export interface SignUpState {
  error: string | null;
  values: {
    firstName?: string;
    lastName?: string;
    email?: string;
    termsAccepted?: boolean;
  };
}

export async function signUp(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  const email = field(formData, "email").toLowerCase();
  const password = field(formData, "password");
  const confirmPassword = field(formData, "confirmPassword");
  const firstName = normalizeName(field(formData, "firstName"));
  const lastName = normalizeName(field(formData, "lastName"));
  // Checkbox: browsers only send "on" when checked, so absent === unchecked.
  const termsAccepted = formData.get("acceptTerms") === "on";

  // Snapshot of everything the user typed except the one field that breaks.
  // Each branch builds this for itself so the broken field is dropped.
  const allValues = {
    firstName,
    lastName,
    email,
    termsAccepted,
  };
  const without = (key: keyof typeof allValues): SignUpState["values"] => {
    const v = { ...allValues } as Partial<typeof allValues>;
    delete v[key];
    return v as SignUpState["values"];
  };

  if (!termsAccepted) {
    return { error: "terms_required", values: allValues };
  }
  if (!firstName) {
    return { error: "missing_first_name", values: without("firstName") };
  }
  if (!lastName) {
    return { error: "missing_last_name", values: without("lastName") };
  }
  if (!NAME_RE.test(firstName)) {
    return { error: "invalid_first_name", values: without("firstName") };
  }
  if (!NAME_RE.test(lastName)) {
    return { error: "invalid_last_name", values: without("lastName") };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "invalid_email", values: without("email") };
  }
  if (password.length < 8) {
    // Both password fields clear (user has to re-enter both on any password
    // error). Names/email/phone preserved.
    return { error: "weak_password", values: allValues };
  }
  if (password !== confirmPassword) {
    return { error: "password_mismatch", values: allValues };
  }

  // Auto-derive a unique username from the email. User can change it later
  // in /me/settings.
  const username = await deriveUniqueUsername(email);

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
    // Email enumeration protection: when Supabase says "user already
    // exists" we must NOT reveal that to the client. Telling the user
    // "email_taken" gives any visitor a way to learn whether an address
    // has an account here — fuel for phishing, credential stuffing, and
    // targeted harassment. Bounce them to the same "check your email"
    // interstitial we send a real new-user to. The interstitial's copy
    // is intentionally hedged ("if that email isn't already on Rallypot,
    // we've sent a link…") so it reads correctly for both paths, with a
    // visible "Sign in" link for the existing-user branch.
    if (msg.includes("already")) {
      redirect("/login?mode=verify&email=" + encodeURIComponent(email));
    }
    let code = "signup_failed";
    if (msg.includes("rate") || msg.includes("for security")) code = "rate_limited";
    else if (msg.includes("smtp") || msg.includes("sending") || msg.includes("confirmation"))
      code = "smtp_failure";
    else if (msg.includes("disabled")) code = "signups_disabled";
    return { error: code, values: allValues };
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
