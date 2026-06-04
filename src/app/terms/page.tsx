import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export const metadata = { title: `Terms · ${process.env.NEXT_PUBLIC_APP_NAME ?? "Rallypot"}` };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 py-2 text-[var(--text)]">
      <header className="space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Legal
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Terms of Service
        </h1>
        <p className="text-xs text-[var(--text-muted)]">
          Last updated: June 3, 2026 · Effective immediately on the date you create an account.
        </p>
      </header>

      <Section title="1. Acceptance">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of {APP_NAME}
          (the &ldquo;Service&rdquo;) operated by the {APP_NAME} team (&ldquo;we&rdquo;,
          &ldquo;us&rdquo;). By creating an account or using the Service, you agree to be bound by
          these Terms and our{" "}
          <Link href="/privacy" className="text-[var(--primary)] hover:underline">
            Privacy Policy
          </Link>
          . If you do not agree, do not use the Service.
        </p>
      </Section>

      <Section title="2. Eligibility">
        <ul className="list-disc space-y-2 pl-5">
          <li>You must be at least 18 years old.</li>
          <li>You must reside in a US state where free-to-play prediction contests are
            permitted, and you must verify your location via device GPS when prompted.</li>
          <li>You must not be subject to any sanctions list, gambling self-exclusion,
            or judicial order prohibiting your use of contest products.</li>
          <li>You may hold only one account. Multi-accounting is grounds for permanent ban
            and forfeiture of any in-app balance.</li>
        </ul>
      </Section>

      <Section title="3. Phase 1 — free-to-play only">
        <p>
          The Service is currently offered as a free-to-play product. Entry fees, prizes,
          and account balances are denominated in virtual currency that has no cash value
          and cannot be redeemed, withdrawn, transferred, exchanged, or sold. Nothing in
          the Service constitutes wagering, betting, gambling, or a sweepstakes.
        </p>
        <p className="mt-3">
          Real-money play, if and when introduced, will be governed by additional terms
          and will only be made available to users in jurisdictions where it is lawful
          and after the Service is licensed or otherwise authorized to offer such
          contests.
        </p>
      </Section>

      <Section title="4. Skill contest model">
        <p>
          Contests on the Service are <strong>peer-to-peer skill contests</strong>. Each
          contest asks a numeric prediction (for example: &ldquo;How many passing yards in
          Q2?&rdquo;). The entrant whose answer is closest to the official statistical
          result wins the pool. Ties split the pool evenly. We do not take positions
          against players and do not act as a counterparty to any contest.
        </p>
      </Section>

      <Section title="5. Your account">
        <p>
          You are responsible for safeguarding your password, your authentication tokens,
          and any device you use to access the Service. You agree to notify us
          immediately of any unauthorized access. We are not liable for any loss arising
          from your failure to comply with this section.
        </p>
      </Section>

      <Section title="6. Conduct">
        <p>You will not:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Use bots, scripts, automated tools, or any other means to enter or influence contests;</li>
          <li>Provide false identity or location information;</li>
          <li>Collude with other entrants;</li>
          <li>Reverse engineer, scrape, or copy any portion of the Service;</li>
          <li>Use the Service in any jurisdiction in which it is not authorized; or</li>
          <li>Interfere with the operation of the Service or any other user&apos;s enjoyment of it.</li>
        </ul>
      </Section>

      <Section title="7. Suspension and termination">
        <p>
          We may suspend or terminate your account at any time, with or without notice,
          for any conduct that we determine, in our sole discretion, violates these
          Terms or is harmful to other users, third parties, or the Service. On
          termination, any virtual balance is forfeited.
        </p>
      </Section>

      <Section title="8. Disclaimers">
        <p>
          The Service is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
          <strong>&ldquo;as available&rdquo;</strong>. To the maximum extent permitted by
          law, we disclaim all warranties, express or implied, including the implied
          warranties of merchantability, fitness for a particular purpose, and
          non-infringement. We do not warrant that the Service will be uninterrupted,
          error-free, or secure.
        </p>
      </Section>

      <Section title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, in no event will our aggregate
          liability arising out of or relating to the Service exceed the greater of (a)
          $100 USD or (b) the amounts you paid to us, if any, in the twelve months
          preceding the event giving rise to the claim. We are not liable for indirect,
          incidental, consequential, special, exemplary, or punitive damages.
        </p>
      </Section>

      <Section title="10. Changes">
        <p>
          We may update these Terms from time to time. Material changes will be
          announced via email or in the Service. Continued use after the effective date
          of any change constitutes acceptance.
        </p>
      </Section>

      <Section title="11. Governing law">
        <p>
          These Terms are governed by the laws of the State of Delaware, without regard
          to its conflict-of-laws principles. Any dispute will be resolved in the state
          or federal courts located in Delaware.
        </p>
      </Section>

      <Section title="12. Contact">
        <p>
          Questions about these Terms? Email{" "}
          <a
            href="mailto:hello@rallypot.org"
            className="text-[var(--primary)] hover:underline"
          >
            hello@rallypot.org
          </a>
          .
        </p>
      </Section>

      <p className="pt-2 text-center text-xs text-[var(--text-muted)]">
        <Link href="/" className="hover:text-white hover:underline">
          ← Back
        </Link>
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 text-sm leading-relaxed text-[var(--text-muted)]">
      <h2 className="font-display text-base font-semibold text-[var(--text)]">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
