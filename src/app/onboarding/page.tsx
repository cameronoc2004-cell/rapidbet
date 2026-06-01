import { redirect } from "next/navigation";
import {
  getCurrentSession,
  getOnboardingStatus,
} from "@/lib/session";
import { PLAY_MIN_AGE_YEARS, PLAY_PERMITTED_STATES } from "@/lib/config";
import { resendVerification } from "../(auth)/login/actions";
import { submitDateOfBirth, submitState } from "./actions";

const ERR: Record<string, string> = {
  invalid_dob: "Enter a valid date.",
  underage: `You must be at least ${PLAY_MIN_AGE_YEARS} to play.`,
  invalid_state: "Pick your state.",
  state_blocked: "We can't offer contests in that state right now.",
};

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/login");
  const status = getOnboardingStatus(session);
  if (status.complete) redirect("/");

  const { error } = await searchParams;
  const email = session.authUser?.email ?? "";

  return (
    <div className="mx-auto mt-8 max-w-md space-y-6">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--primary)]">
          Onboarding
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--text)]">
          Verify your account
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          We verify a few things before you can play — required by law and by
          our peer-to-peer contest model.
        </p>
      </header>

      <ProgressDots
        steps={[
          { label: "Email", done: status.emailVerified },
          { label: `Age ${PLAY_MIN_AGE_YEARS}+`, done: status.ageVerified },
          { label: "State", done: status.stateVerified },
        ]}
      />

      {error && ERR[error] && (
        <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {ERR[error]}
        </p>
      )}

      <StepCard
        n={1}
        title="Verify your email"
        done={status.emailVerified}
      >
        {status.emailVerified ? (
          <p className="text-sm text-[var(--text-muted)]">
            <span className="font-mono text-[var(--text)]">{email}</span> is verified.
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--text-muted)]">
              We sent a confirmation link to{" "}
              <span className="font-mono text-[var(--text)]">{email}</span>.
              Click it, then come back here.
            </p>
            <form action={resendVerification} className="mt-3">
              <input type="hidden" name="email" value={email} />
              <button
                type="submit"
                className="text-xs text-[var(--primary)] underline-offset-2 hover:underline"
              >
                Resend confirmation email
              </button>
            </form>
          </>
        )}
      </StepCard>

      <StepCard
        n={2}
        title={`Confirm you're ${PLAY_MIN_AGE_YEARS}+`}
        done={status.ageVerified}
      >
        {status.ageVerified ? (
          <p className="text-sm text-[var(--text-muted)]">
            Date of birth on file:{" "}
            <span className="font-mono text-[var(--text)]">{session.profile.dateOfBirth}</span>.
          </p>
        ) : (
          <form action={submitDateOfBirth} className="space-y-3">
            <label className="block">
              <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Date of birth
              </span>
              <input
                name="dob"
                type="date"
                required
                max={maxDobForAge(PLAY_MIN_AGE_YEARS)}
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
              />
            </label>
            <p className="text-[11px] text-[var(--text-muted)]">
              We use this to confirm eligibility. It is never shown publicly.
            </p>
            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)]"
            >
              Save
            </button>
          </form>
        )}
      </StepCard>

      <StepCard
        n={3}
        title="Confirm your state"
        done={status.stateVerified}
      >
        {status.stateVerified ? (
          <p className="text-sm text-[var(--text-muted)]">
            State on file:{" "}
            <span className="font-mono text-[var(--text)]">{session.profile.stateCode}</span>.
          </p>
        ) : (
          <form action={submitState} className="space-y-3">
            <label className="block">
              <span className="block text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
                State
              </span>
              <select
                name="stateCode"
                required
                defaultValue=""
                className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
              >
                <option value="" disabled>
                  Select state
                </option>
                {PLAY_PERMITTED_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-[var(--text-muted)]">
              Real-money play requires a verified device-GPS location and is
              limited to states approved by our gaming counsel. Phase 1 is
              free-to-play.
            </p>
            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)]"
            >
              Save
            </button>
          </form>
        )}
      </StepCard>

      <div className="pt-2 text-center">
        <a
          href="/me"
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] hover:underline"
        >
          Manage profile →
        </a>
      </div>
    </div>
  );
}

function StepCard({
  n, title, done, children,
}: {
  n: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border p-5 transition-colors ${
        done
          ? "border-[var(--primary-lo)]/40 bg-[var(--surface)]/80"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs ${
              done
                ? "bg-[var(--primary-lo)]/15 text-[var(--primary)]"
                : "bg-[var(--surface-2)] text-[var(--text-muted)]"
            }`}
          >
            {done ? "✓" : n}
          </span>
          <h2 className="font-display text-base font-semibold text-[var(--text)]">
            {title}
          </h2>
        </div>
        {done && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
            Verified
          </span>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ProgressDots({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-1 items-center gap-2">
          <span
            className={`inline-block h-1.5 flex-1 rounded-full ${
              s.done ? "bg-[var(--primary)]" : "bg-[var(--surface-2)]"
            }`}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function maxDobForAge(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}
