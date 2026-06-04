import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export const metadata = { title: `Privacy · ${process.env.NEXT_PUBLIC_APP_NAME ?? "Rallypot"}` };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 py-2 text-[var(--text)]">
      <header className="space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Legal
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xs text-[var(--text-muted)]">
          Last updated: June 3, 2026
        </p>
      </header>

      <Section title="1. Information we collect">
        <p>We collect the following categories of information when you use {APP_NAME}:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account information:</strong> email address, username, and password
            (hashed). Provided by you at sign-up.
          </li>
          <li>
            <strong>Verification information:</strong> date of birth and US state code,
            obtained from device GPS at onboarding. We do not store identity documents
            in Phase 1.
          </li>
          <li>
            <strong>Contest activity:</strong> the predictions you submit, contest
            outcomes, and your skill-score history.
          </li>
          <li>
            <strong>Wallet ledger:</strong> every virtual-currency credit or debit to
            your account, immutably logged.
          </li>
          <li>
            <strong>Notification tokens:</strong> if you opt in, your browser or device
            push-notification token.
          </li>
          <li>
            <strong>Technical:</strong> IP address, user agent, and timestamps of
            requests, retained for security and abuse-prevention.
          </li>
        </ul>
      </Section>

      <Section title="2. How we use information">
        <ul className="list-disc space-y-2 pl-5">
          <li>Operate the Service: authenticate you, run contests, settle pools.</li>
          <li>Communicate with you: transactional emails (verification, password reset, contest results) and opt-in push notifications.</li>
          <li>Comply with legal obligations: anti-fraud, anti-money-laundering, and
            jurisdictional eligibility (free-to-play state allow-list).</li>
          <li>Improve the Service: aggregate usage analytics.</li>
          <li>Maintain an audit trail of money and identity events, as required for
            future real-money operations.</li>
        </ul>
      </Section>

      <Section title="3. Subprocessors">
        <p>
          We rely on the following service providers (&ldquo;subprocessors&rdquo;) who
          process personal information on our behalf:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Vercel</strong> — hosting and CDN (USA).</li>
          <li><strong>Supabase</strong> — authentication, Postgres database, and file storage (USA).</li>
          <li><strong>Resend</strong> — transactional email delivery (USA / EU).</li>
          <li><strong>Firebase Cloud Messaging</strong> — push notifications, operated by Google LLC.</li>
          <li><strong>US Census Geocoder</strong> — reverse geocoding latitude / longitude into US state codes. No personal information beyond coordinates is transmitted.</li>
        </ul>
        <p className="mt-3">
          Each subprocessor is contractually obligated to protect information consistent
          with their own privacy practices. When real-money play launches, additional
          subprocessors will be added (payment processor, KYC vendor, real-money
          geo-verification vendor) and disclosed here in advance.
        </p>
      </Section>

      <Section title="4. Cookies and similar technologies">
        <p>
          We use first-party cookies necessary for authentication and session
          management. We do not use third-party advertising cookies. You can disable
          cookies in your browser, but doing so will prevent you from signing in.
        </p>
      </Section>

      <Section title="5. Data retention">
        <p>
          Account data is retained for as long as your account is active. After account
          deletion, financial-audit records may be retained for up to 7 years to comply
          with anti-money-laundering and tax obligations. Other personal information is
          deleted within 90 days of account closure.
        </p>
      </Section>

      <Section title="6. Your rights">
        <p>
          You may request access to, correction of, or deletion of your personal
          information by emailing{" "}
          <a href="mailto:privacy@rallypot.org" className="text-[var(--primary)] hover:underline">
            privacy@rallypot.org
          </a>
          . If you are a California resident, you may also exercise the rights granted
          under the CCPA/CPRA. We do not sell personal information.
        </p>
      </Section>

      <Section title="7. Children">
        <p>
          The Service is intended for users 18 and older. We do not knowingly collect
          information from individuals under 18. If you believe a minor has provided
          information to us, contact us and we will delete it.
        </p>
      </Section>

      <Section title="8. Security">
        <p>
          We use industry-standard safeguards including encryption in transit (TLS),
          encryption at rest, role-based access controls, and Row Level Security on our
          database. No system is perfectly secure; in the event of a breach affecting
          your information, we will notify you within the timeline required by law.
        </p>
      </Section>

      <Section title="9. International users">
        <p>
          The Service is operated from the United States. By using the Service, you
          consent to the transfer of your information to the United States, which may
          have data-protection laws different from those of your country.
        </p>
      </Section>

      <Section title="10. Changes">
        <p>
          We may update this Privacy Policy from time to time. Material changes will be
          announced via email or in the Service. The &ldquo;Last updated&rdquo; date at
          the top of this page reflects the most recent revision.
        </p>
      </Section>

      <Section title="11. Contact">
        <p>
          Questions about this Privacy Policy? Email{" "}
          <a href="mailto:privacy@rallypot.org" className="text-[var(--primary)] hover:underline">
            privacy@rallypot.org
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
