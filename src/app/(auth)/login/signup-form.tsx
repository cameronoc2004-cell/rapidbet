"use client";

import Link from "next/link";
import { useActionState, type KeyboardEvent } from "react";
import { signUp, type SignUpState } from "./actions";

// Enter on any field except the last → focus the next visible input.
// Makes the iOS "Next" keyboard chevron actually advance, matching the
// behavior of every native iOS form. Falls back to submit on the last
// field (where enterKeyHint="done" so iOS shows the action key).
function advanceOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  const form = e.currentTarget.form;
  if (!form) return;
  const inputs = Array.from(form.elements).filter(
    (el): el is HTMLInputElement =>
      el instanceof HTMLInputElement &&
      !el.disabled &&
      el.type !== "hidden" &&
      el.type !== "checkbox" &&
      el.type !== "submit",
  );
  const i = inputs.indexOf(e.currentTarget);
  if (i === -1 || i === inputs.length - 1) return;
  e.preventDefault();
  inputs[i + 1].focus();
}

const ERRORS: Record<string, string> = {
  weak_password: "Password must be at least 8 characters.",
  password_mismatch: "Passwords don't match.",
  invalid_email: "Please enter a valid email.",
  signup_failed: "Couldn't sign you up. Try again.",
  rate_limited: "Too many signups from this email recently. Wait a minute and try again.",
  smtp_failure: "We couldn't send the confirmation email. Try again in a few minutes.",
  signups_disabled: "Signups are temporarily paused. Try again soon.",
  missing_first_name: "Enter your first name.",
  missing_last_name: "Enter your last name.",
  invalid_first_name: "First name has invalid characters.",
  invalid_last_name: "Last name has invalid characters.",
  invalid_phone: "Enter a valid phone number (10–15 digits).",
  phone_taken: "That phone number is already linked to another Rallypot account.",
  terms_required: "You must agree to the Terms of Service and Privacy Policy.",
};

const INITIAL: SignUpState = { error: null, values: {} };

// Signup form. Uses useActionState so a validation failure keeps every value
// the user typed — only the broken field comes back empty, and they re-type
// just that one. Passwords are always cleared on any error (security + most
// browsers ignore defaultValue on type=password anyway).
export function SignUpForm() {
  const [state, formAction, pending] = useActionState(signUp, INITIAL);
  const v = state.values;

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="First name"
          name="firstName"
          autoComplete="given-name"
          defaultValue={v.firstName ?? ""}
          required
        />
        <Field
          label="Last name"
          name="lastName"
          autoComplete="family-name"
          defaultValue={v.lastName ?? ""}
          required
        />
      </div>
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={v.email ?? ""}
        required
      />
      <Field
        label="Phone (optional)"
        name="phone"
        type="tel"
        autoComplete="tel"
        defaultValue={v.phone ?? ""}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        required
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        enterKeyHint="done"
        required
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 transition-colors hover:border-[var(--primary-lo)]/60">
        <input
          type="checkbox"
          name="acceptTerms"
          defaultChecked={v.termsAccepted ?? false}
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
        <span className="text-xs leading-relaxed text-[var(--text-muted)]">
          I am 18+ and I agree to the{" "}
          <Link href="/terms" className="text-[var(--primary)] hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-[var(--primary)] hover:underline">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {state.error && ERRORS[state.error] ? (
        <ErrorBanner text={ERRORS[state.error]} />
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="pt-2 text-center text-[11px] text-[var(--text-muted)]">
        We&apos;ll send a verification link to your email.
      </p>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
  required,
  placeholder,
  autoComplete,
  enterKeyHint = "next",
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  // iOS keyboard's bottom-right action key. "next" advances focus; "done"
  // submits / dismisses. The last field in the form should be "done".
  enterKeyHint?: "next" | "done" | "go" | "search" | "send" | "enter";
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete ?? (type === "password" ? "current-password" : name)}
        enterKeyHint={enterKeyHint}
        onKeyDown={advanceOnEnter}
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

