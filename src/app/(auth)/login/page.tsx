import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfileId } from "@/lib/session";
import { resendVerification, signIn, signUp } from "./actions";
import { APP_NAME } from "@/lib/config";

const ERRORS: Record<string, string> = {
  bad_credentials: "Incorrect email or password.",
  invalid_username: "Username must be 3–20 chars: a–z, 0–9, underscore.",
  weak_password: "Password must be at least 8 characters.",
  invalid_email: "Please enter a valid email.",
  username_taken: "That username is already taken.",
  email_taken: "An account with that email already exists.",
  signup_failed: "Couldn't sign you up. Try again.",
  verify_failed: "That confirmation link is expired or already used.",
  missing_code: "Confirmation link was missing its code.",
};

interface PageProps {
  searchParams: Promise<{
    mode?: string;
    error?: string;
    email?: string;
    resent?: string;
  }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  if (await getCurrentProfileId()) redirect("/");
  const { mode, error, email, resent } = await searchParams;

  return (
    <div className="mx-auto mt-12 max-w-sm">
      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--primary)]">
          Free-to-play · Phase 1
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--text)]">
          {APP_NAME}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Per-quarter prediction contests. Closest answer wins the pool.
        </p>
      </div>

      {mode === "verify" ? (
        <VerifyEmailCard email={email} resent={resent === "1"} error={error} />
      ) : (
        <>
          <div className="mt-8 flex border-b border-[var(--border)]">
            <Tab href="/login" active={mode !== "signup"}>
              Sign in
            </Tab>
            <Tab href="/login?mode=signup" active={mode === "signup"}>
              Sign up
            </Tab>
          </div>

          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            {mode === "signup" ? (
              <form action={signUp} className="space-y-3">
                <Field label="Email" name="email" type="email" required />
                <Field
                  label="Username"
                  name="username"
                  placeholder="3–20 chars · a–z 0–9 _"
                  required
                />
                <Field
                  label="Password"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  required
                />
                {error && ERRORS[error] && <ErrorBanner text={ERRORS[error]} />}
                <SubmitButton>Create account</SubmitButton>
              </form>
            ) : (
              <form action={signIn} className="space-y-3">
                <Field label="Email" name="email" type="email" required />
                <Field label="Password" name="password" type="password" required />
                {error && ERRORS[error] && <ErrorBanner text={ERRORS[error]} />}
                <SubmitButton>Sign in</SubmitButton>
              </form>
            )}
          </div>
        </>
      )}

      <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
        <Link href="/" className="hover:text-[var(--text)] hover:underline">
          ← Back to events
        </Link>
      </p>
    </div>
  );
}

function VerifyEmailCard({
  email,
  resent,
  error,
}: {
  email?: string;
  resent: boolean;
  error?: string;
}) {
  return (
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
      <h2 className="font-display text-xl font-semibold text-[var(--text)]">
        Check your email
      </h2>
      <p className="text-sm text-[var(--text-muted)]">
        We sent a confirmation link to{" "}
        {email ? (
          <span className="text-[var(--text)] font-mono">{email}</span>
        ) : (
          <span>your inbox</span>
        )}
        . Click it to verify, then continue onboarding.
      </p>
      {error && ERRORS[error] && <ErrorBanner text={ERRORS[error]} />}
      {resent && (
        <div className="rounded-md border border-[var(--primary-lo)]/40 bg-[var(--primary-lo)]/10 px-3 py-2 text-xs text-[var(--primary)]">
          Sent another link.
        </div>
      )}
      {email && (
        <form action={resendVerification}>
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            className="text-xs text-[var(--text-muted)] underline-offset-2 transition-colors hover:text-[var(--text)] hover:underline"
          >
            Didn&apos;t get it? Resend
          </button>
        </form>
      )}
      <p className="pt-2 text-xs text-[var(--text-muted)]">
        Already verified?{" "}
        <Link href="/login" className="text-[var(--primary)] hover:underline">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px flex-1 border-b-2 px-3 py-2 text-center text-sm font-medium transition-colors ${
        active
          ? "border-[var(--primary)] text-[var(--text)]"
          : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
      }`}
    >
      {children}
    </Link>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={type === "password" ? "current-password" : name}
        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/70 focus:border-[var(--primary)]"
      />
    </label>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
      {text}
    </p>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)]"
    >
      {children}
    </button>
  );
}
