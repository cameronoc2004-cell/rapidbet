import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { setNewPassword } from "./actions";
import { APP_NAME } from "@/lib/config";

const ERRORS: Record<string, string> = {
  weak: "Password must be at least 8 characters.",
  mismatch: "Passwords don't match.",
  failed: "Couldn't update password. Try the reset link again.",
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  // The user lands here right after /auth/callback exchanged the recovery
  // code for a session. If there's no session, they hit this URL directly —
  // bounce them back to /forgot-password.
  const session = await getCurrentSession();
  if (!session) redirect("/forgot-password");

  const { error } = await searchParams;

  return (
    <div className="mx-auto mt-12 max-w-sm">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--primary)]">
          {APP_NAME}
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[var(--text)]">
          Choose a new password
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Setting password for{" "}
          <span className="font-mono text-[var(--text)]">{session.authUser.email}</span>
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <form action={setNewPassword} className="space-y-3">
          <label className="block">
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              New password
            </span>
            <input
              name="password"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/70 focus:border-[var(--primary)]"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Confirm
            </span>
            <input
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
              minLength={8}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
            />
          </label>
          {error && ERRORS[error] && (
            <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {ERRORS[error]}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40"
          >
            Update password
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        <Link href="/me" className="hover:text-white hover:underline">
          Skip — go to my profile
        </Link>
      </p>
    </div>
  );
}
