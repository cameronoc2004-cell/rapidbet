import Link from "next/link";
import { requestPasswordReset } from "./actions";
import { APP_NAME } from "@/lib/config";

const ERRORS: Record<string, string> = {
  invalid_email: "Please enter a valid email.",
};

interface PageProps {
  searchParams: Promise<{ sent?: string; email?: string; error?: string }>;
}

export default async function ForgotPasswordPage({ searchParams }: PageProps) {
  const { sent, email, error } = await searchParams;

  return (
    <div className="mx-auto mt-12 max-w-sm">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--primary)]">
          {APP_NAME}
        </div>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[var(--text)]">
          Reset your password
        </h1>
      </div>

      {sent === "1" ? (
        <div className="mt-8 space-y-4 rounded-xl border border-[var(--primary-lo)]/40 bg-[var(--surface)] p-6 text-center">
          <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--primary-lo)]/15">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[var(--primary)]"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-semibold text-[var(--text)]">
            Check your email
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            If an account exists for{" "}
            {email ? (
              <span className="font-mono text-[var(--text)]">{email}</span>
            ) : (
              <span>that address</span>
            )}
            , we sent a password-reset link. The link expires in 1 hour.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            <Link href="/login" className="text-[var(--primary)] hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <form action={requestPasswordReset} className="space-y-3">
            <label className="block">
              <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Email
              </span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/70 focus:border-[var(--primary)]"
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
              Send reset link
            </button>
          </form>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        <Link href="/login" className="hover:text-white hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
