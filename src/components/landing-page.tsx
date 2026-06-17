import Link from "next/link";
import { BrandWordmark } from "./brand-wordmark";
import { NativeGate } from "./native-gate";

// Logged-out marketing landing for rallypot.org. Shown to signed-out web
// visitors instead of dropping them on the login form. In the native app the
// NativeGate redirects to /login, so the app's flow is unchanged.
//
// Copy is intentionally neutral on legal characterization (no "skill",
// "betting", "gambling", "sweepstakes") — mechanics only. [[ATTORNEY: confirm
// marketing copy and any required disclosures before launch.]]
export function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-2 py-10 md:py-16">
      <NativeGate redirectTo="/login" />

      {/* Hero */}
      <section className="flex flex-col items-center text-center">
        <BrandWordmark className="font-display text-5xl font-bold tracking-tight md:text-7xl" />
        <p className="mt-6 max-w-xl text-lg text-[var(--text-muted)] md:text-xl">
          Peer-to-peer prediction contests on real sporting events. Pay a fixed
          buy-in, everyone&apos;s entry forms the pot, and the closest answer
          takes it.
        </p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/login?mode=signup"
            className="w-full rounded-lg bg-[var(--primary)] px-7 py-3 text-center text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] sm:w-auto"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-[var(--border)] px-7 py-3 text-center text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--primary-lo)] sm:w-auto"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mt-20 md:mt-28">
        <h2 className="text-center font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--primary)]">
          How it works
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Step
            n="1"
            title="Pick a question"
            body="Predict a single number about a real game — like points scored in a quarter."
          />
          <Step
            n="2"
            title="Pay the buy-in"
            body="A fixed entry fee joins the contest. Every entry adds to the shared pot."
          />
          <Step
            n="3"
            title="Closest answer wins"
            body="When the game's official result is in, the closest prediction takes the pot, minus a small service fee."
          />
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mt-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center md:mt-28 md:p-12">
        <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--text)] md:text-3xl">
          Ready to play?
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-muted)]">
          Create an account in under a minute.
        </p>
        <Link
          href="/login?mode=signup"
          className="mt-6 inline-block rounded-lg bg-[var(--primary)] px-7 py-3 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)]"
        >
          Create account
        </Link>
        <p className="mt-8 flex justify-center gap-4 text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
        </p>
      </section>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-lo)]/15 font-mono text-sm font-bold text-[var(--primary)]">
        {n}
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-[var(--text)]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
        {body}
      </p>
    </div>
  );
}
