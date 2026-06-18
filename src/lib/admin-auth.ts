import { cookies } from "next/headers";
import crypto from "node:crypto";
import { ADMIN_EMAILS } from "./config";

// Admin access = email in the Vercel ADMIN_EMAILS allowlist AND the universal
// ADMIN_PASSCODE (a Vercel env var). There are no per-admin passwords and no
// Supabase account for admins. On success we set a signed, HttpOnly cookie that
// gates the /admin area; it's signed with the passcode itself, so rotating the
// passcode in Vercel instantly invalidates every existing admin session.
//
// Fail-closed: if ADMIN_PASSCODE isn't set, nobody can sign in.

const COOKIE = "rp_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24; // 24h

function passcode(): string {
  return process.env.ADMIN_PASSCODE ?? "";
}

function sign(payload: string): string {
  return crypto
    .createHmac("sha256", passcode())
    .update(payload)
    .digest("base64url");
}

function timingEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function emailAllowed(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

// Both must be right. Returns false (no entry) if either the email isn't on the
// allowlist or the passcode doesn't match — without revealing which.
export function verifyAdminCredentials(email: string, code: string): boolean {
  const pc = passcode();
  if (!pc) return false; // not configured → deny everyone
  if (!emailAllowed(email)) return false;
  return timingEqual(code, pc);
}

export async function setAdminSession(email: string): Promise<void> {
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = Buffer.from(
    JSON.stringify({ e: email.trim().toLowerCase(), x: exp }),
  ).toString("base64url");
  const value = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

// Returns the signed-in admin's email, or null. Verifies the signature, the
// expiry, and that the email is STILL on the allowlist (so removing someone in
// Vercel revokes their session on the next request after a redeploy).
export async function getAdminEmail(): Promise<string | null> {
  if (!passcode()) return null;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !timingEqual(sig, sign(payload))) return null;
  let data: { e?: string; x?: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (!data.e || !data.x || data.x < Date.now() || !emailAllowed(data.e)) {
    return null;
  }
  return data.e;
}

export async function isAdminAuthed(): Promise<boolean> {
  return (await getAdminEmail()) !== null;
}
