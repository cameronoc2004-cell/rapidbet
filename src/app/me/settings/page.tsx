import Link from "next/link";
import { requireOnboarded } from "@/lib/session";
import { updateProfile } from "@/app/me/actions";

export const dynamic = "force-dynamic";

const ERR: Record<string, string> = {
  missing_username: "Enter a username.",
  invalid_username: "Usernames are 3–20 characters: letters, numbers, underscore, period.",
  username_taken: "That username is already taken.",
  phone_taken: "That phone number is already linked to another Rallypot account.",
  invalid_phone: "Enter a valid phone number (10–15 digits).",
  invalid_postal: "Enter a valid US ZIP code (12345 or 12345-6789).",
  missing_first_name: "Enter your first name.",
  missing_last_name: "Enter your last name.",
  invalid_first_name: "First name has invalid characters.",
  invalid_last_name: "Last name has invalid characters.",
};

const OK: Record<string, string> = {
  updated: "Profile updated.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await requireOnboarded();
  const profile = session.profile!;
  const { error, ok } = await searchParams;

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <Link
          href="/me"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← Back to profile
        </Link>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--text)]">
          Edit profile
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Update your username, phone, and home address. Email, date of birth,
          and state are managed elsewhere.
        </p>
      </header>

      {error && ERR[error] && (
        <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {ERR[error]}
        </p>
      )}
      {ok && OK[ok] && (
        <p className="rounded-md border border-[var(--primary-lo)]/40 bg-[var(--primary-lo)]/10 px-3 py-2 text-sm text-[var(--primary)]">
          {OK[ok]}
        </p>
      )}

      <form action={updateProfile} className="space-y-6">
        <Section title="Account">
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="firstName"
              label="First name"
              defaultValue={profile.firstName ?? ""}
              required
              autoComplete="given-name"
              placeholder="Jane"
            />
            <Field
              name="lastName"
              label="Last name"
              defaultValue={profile.lastName ?? ""}
              required
              autoComplete="family-name"
              placeholder="Doe"
            />
          </div>
          <Field
            name="username"
            label="Username"
            defaultValue={profile.username}
            required
            autoComplete="username"
            placeholder="yourname"
            hint="3–20 characters: letters, numbers, underscore, period."
          />
          <ReadOnlyField
            label="Email"
            value={session.authUser?.email ?? ""}
            hint="Email changes are coming. Contact support if you need this updated."
          />
          <Field
            name="phone"
            label="Phone"
            defaultValue={profile.phone ?? ""}
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 123 4567"
            hint="Optional. We use this for account recovery and SMS alerts."
          />
        </Section>

        <Section title="Home address">
          <Field
            name="addressLine1"
            label="Street address"
            defaultValue={profile.addressLine1 ?? ""}
            autoComplete="address-line1"
            placeholder="123 Main St"
          />
          <Field
            name="addressLine2"
            label="Apartment, suite, etc."
            defaultValue={profile.addressLine2 ?? ""}
            autoComplete="address-line2"
            placeholder="Apt 4B"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              name="city"
              label="City"
              defaultValue={profile.city ?? ""}
              autoComplete="address-level2"
              placeholder="Dallas"
            />
            <Field
              name="postalCode"
              label="ZIP code"
              defaultValue={profile.postalCode ?? ""}
              autoComplete="postal-code"
              placeholder="75201"
              hint=""
            />
          </div>
          <ReadOnlyField
            label="State"
            value={profile.stateCode ?? "—"}
            hint="State is GPS-verified at onboarding. Move? Contact support."
          />
        </Section>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Link
            href="/me"
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-center text-sm font-medium text-[var(--text-muted)] hover:border-[var(--primary-lo)] hover:text-[var(--text)]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40"
          >
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {title}
      </div>
      {children}
    </section>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required,
  placeholder,
  autoComplete,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
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
        autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
      />
      {hint && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </label>
  );
}

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </span>
      <div className="mt-1.5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2.5 text-sm text-[var(--text-muted)]">
        {value}
      </div>
      {hint && <p className="mt-1 text-[11px] text-[var(--text-muted)]">{hint}</p>}
    </div>
  );
}
