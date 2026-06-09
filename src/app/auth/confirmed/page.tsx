import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export const dynamic = "force-static";

// Reached after the user clicks the email-confirmation link Supabase sent
// them. The /auth/callback route exchanges the code (which is what actually
// marks email_confirmed_at in auth.users) and signs them back out, then
// redirects here. The user reads the success copy, taps "Back to the app",
// and lands on /login to sign in for the first time.
export default function ConfirmedPage() {
  return (
    <div className="mx-auto mt-12 max-w-sm">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--primary)]">
          Email confirmed
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--text)]">
          {APP_NAME}
        </h1>
      </div>

      <div className="mt-8 rounded-xl border border-[var(--primary-lo)]/40 bg-[var(--surface)] p-6 text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-lo)]/15">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--primary)]"
            aria-hidden="true"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 font-display text-xl font-semibold text-[var(--text)]">
          Your email is confirmed
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          You can now sign in to {APP_NAME} and finish setting up your account.
        </p>

        <Link
          href="/login"
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40"
        >
          Sign in
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
