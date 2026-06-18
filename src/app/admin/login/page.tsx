import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { adminSignIn } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin sign-in · RallyPot",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  denied: "Invalid email or passcode.",
};

// Admin sign-in. No sign-up — accounts are provisioned manually in Supabase.
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAdmin()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div className="mx-auto mt-24 max-w-sm">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          <span className="text-[var(--text)]">Rally</span>
          <span className="text-[var(--primary)]">Pot</span>
          <span className="ml-2 align-middle font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Admin
          </span>
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Authorized team members only.
        </p>
      </div>

      <form
        action={adminSignIn}
        className="mt-8 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
      >
        <Field label="Email" name="email" type="email" required />
        <Field label="Passcode" name="passcode" type="password" required />
        {error && ERRORS[error] && (
          <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {ERRORS[error]}
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)]"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
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
        autoComplete={type === "password" ? "current-password" : "email"}
        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
      />
    </label>
  );
}
