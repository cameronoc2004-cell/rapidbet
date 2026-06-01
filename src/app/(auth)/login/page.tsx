import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfileId } from "@/lib/session";
import { signIn, signUp } from "./actions";
import { TEAM_NAME } from "@/lib/config";

const ERRORS: Record<string, string> = {
  bad_credentials: "Incorrect email or password.",
  invalid_username: "Username must be 3–20 chars: a–z, 0–9, underscore.",
  weak_password: "Password must be at least 8 characters.",
  invalid_email: "Please enter a valid email.",
  username_taken: "That username is already taken.",
  email_taken: "An account with that email already exists.",
  signup_failed: "Couldn't sign you up. Try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string }>;
}) {
  if (await getCurrentProfileId()) redirect("/");
  const { mode, error } = await searchParams;
  const isSignup = mode === "signup";

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="text-3xl font-bold">Rapid Bet</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Play-money predictions for {TEAM_NAME}.
      </p>

      <div className="mt-8 flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <Tab href="/login" active={!isSignup}>
          Sign in
        </Tab>
        <Tab href="/login?mode=signup" active={isSignup}>
          Sign up
        </Tab>
      </div>

      {isSignup ? (
        <form action={signUp} className="mt-6 space-y-3">
          <Field label="Email" name="email" type="email" required />
          <Field
            label="Username"
            name="username"
            placeholder="3–20 chars, a–z 0–9 _"
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
        <form action={signIn} className="mt-6 space-y-3">
          <Field label="Email" name="email" type="email" required />
          <Field label="Password" name="password" type="password" required />
          {error && ERRORS[error] && <ErrorBanner text={ERRORS[error]} />}
          <SubmitButton>Sign in</SubmitButton>
        </form>
      )}

      <p className="mt-6 text-xs text-neutral-500">
        <Link href="/" className="underline">
          Back home
        </Link>
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
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? "border-neutral-900 text-neutral-900 dark:border-white dark:text-white"
          : "border-transparent text-neutral-500"
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
      <span className="block text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={type === "password" ? "current-password" : name}
        className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-white"
      />
    </label>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
      {text}
    </p>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
    >
      {children}
    </button>
  );
}
