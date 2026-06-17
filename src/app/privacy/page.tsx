import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export const metadata = {
  title: `Privacy (DRAFT) · ${process.env.NEXT_PUBLIC_APP_NAME ?? "Rallypot"}`,
  robots: { index: false, follow: false },
};

// =============================================================================
// CONFIG / PLACEHOLDER BLOCK — fill every value here, in one place.
// Each [[TOKEN]] below also appears inline in the document text.
// -----------------------------------------------------------------------------
// [[COMPANY_LEGAL_NAME]]          Full legal name of the data controller / operator.
// [[COMPANY_ADDRESS]]             Registered mailing address of the controller.
// [[PRIVACY_EMAIL]]               Email for privacy requests and questions.
// [[EU_UK_REPRESENTATIVE]]        GDPR/UK Art. 27 representative or DPO, if applicable.
// [[MIN_AGE]]                     Minimum age the Service is directed to (18/19/21).
// [[RETENTION_PERIODS]]           General retention schedule by data category.
// [[KYC_RETENTION_PERIOD]]        Retention period for identity / KYC records.
// [[EFFECTIVE_DATE]]              Effective date of this version.
// --- Sub-processor policy URLs ---
// [[SUPABASE_PRIVACY_URL]]        Supabase privacy policy URL.
// [[TRUSTLY_PRIVACY_URL]]         Trustly privacy policy URL.
// [[DIDIT_PRIVACY_URL]]           Didit privacy policy URL.
// [[RESEND_PRIVACY_URL]]          Resend privacy policy URL.
// [[FIREBASE_GOOGLE_PRIVACY_URL]] Google/Firebase privacy policy URL.
// [[APPLE_PRIVACY_URL]]           Apple privacy policy URL.
// [[VERCEL_PRIVACY_URL]]          Vercel privacy policy URL.
// [[CENSUS_PRIVACY_URL]]          US Census Bureau / Geocoder privacy notice URL.
// =============================================================================

const SECTIONS: { id: string; n: number; title: string }[] = [
  { id: "who", n: 1, title: "Who We Are & How to Contact Us" },
  { id: "collect", n: 2, title: "Data We Collect" },
  { id: "use", n: 3, title: "How We Use Your Data" },
  { id: "bases", n: 4, title: "Legal Bases for Processing (GDPR/UK)" },
  { id: "sharing", n: 5, title: "Sharing & Sub-Processors" },
  { id: "kyc", n: 6, title: "Sensitive Data & Identity (KYC)" },
  { id: "retention", n: 7, title: "Data Retention" },
  { id: "security", n: 8, title: "Security" },
  { id: "transfers", n: 9, title: "International Data Transfers" },
  { id: "children", n: 10, title: "Children" },
  { id: "rights", n: 11, title: "Your Privacy Rights (CCPA/CPRA & GDPR/UK)" },
  { id: "cookies", n: 12, title: "Cookies, SDKs, Analytics & Push Notifications" },
  { id: "changes", n: 13, title: "Changes & Effective Date" },
];

const SUBPROCESSORS: { name: string; purpose: string; url: string }[] = [
  { name: "Supabase", purpose: "Database, authentication, and backend storage/processing.", url: "SUPABASE_PRIVACY_URL" },
  { name: "Trustly", purpose: "Payment processing for deposits and withdrawals (bank-linked).", url: "TRUSTLY_PRIVACY_URL" },
  { name: "Didit", purpose: "Identity verification / KYC, including ID documents and selfies.", url: "DIDIT_PRIVACY_URL" },
  { name: "Resend", purpose: "Transactional email delivery (verification, receipts, notices).", url: "RESEND_PRIVACY_URL" },
  { name: "Firebase Cloud Messaging (Google LLC)", purpose: "Push notification delivery to your device.", url: "FIREBASE_GOOGLE_PRIVACY_URL" },
  { name: "Apple", purpose: "App distribution (App Store), device/OS services, and app analytics.", url: "APPLE_PRIVACY_URL" },
  { name: "Vercel", purpose: "Application hosting and content delivery (processes request metadata such as IP).", url: "VERCEL_PRIVACY_URL" },
  { name: "US Census Geocoder", purpose: "Reverse-geocodes device GPS coordinates into a US state for eligibility.", url: "CENSUS_PRIVACY_URL" },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 py-2 text-[var(--text)]">
      <header className="space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Legal · Draft
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xs text-[var(--text-muted)]">
          Effective: <Ph>EFFECTIVE_DATE</Ph> · Controller: <Ph>COMPANY_LEGAL_NAME</Ph>
        </p>
      </header>

      <ConfigBlock />
      <DraftBanner />

      <Section id="intro" title="Introduction">
        <P>
          {`This Privacy Policy explains how we collect, use, share, and protect personal information when you use `}
          {APP_NAME}
          {` (the "Service"): a peer-to-peer prediction contest platform where users pay a buy-in, contribute to a shared prize pool, and may deposit, hold, and withdraw real money. It applies to the `}
          {APP_NAME}
          {` mobile app and website.`}
        </P>
      </Section>

      <Toc />

      <Section id="who" title="1. Who We Are & How to Contact Us">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`The data controller responsible for your personal information is `}
          <Ph>COMPANY_LEGAL_NAME</Ph>, <Ph>COMPANY_ADDRESS</Ph>.{" "}
          {`For privacy questions or to exercise your rights, contact us at `}
          <Ph>PRIVACY_EMAIL</Ph>.
        </p>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`If you are in the EU or UK, our representative / data protection contact is `}
          <Ph>EU_UK_REPRESENTATIVE</Ph>.{" "}
          <Flag inline>ATTORNEY: confirm whether an Art. 27 representative or DPO is required.</Flag>
        </p>
      </Section>

      <Section id="collect" title="2. Data We Collect">
        <P>{`We collect the following categories of personal information:`}</P>
        <List
          items={[
            `Account information: your name, email address, password (stored hashed), date of birth, and any username.`,
            `Identity / KYC data: government-issued ID documents, a photograph or selfie, and verification results, collected through our verification provider (Didit). See Section 6.`,
            `Financial and banking data: deposit/withdrawal amounts, transaction history, account balance, and bank-linking details processed through our payment provider (Trustly). We do not store full bank credentials ourselves.`,
            `Location data: device GPS coordinates used to confirm you are in a permitted jurisdiction, and the resulting state/region.`,
            `Contest activity: the contests you enter, predictions you submit, outcomes, winnings, and your wallet/ledger history.`,
            `Device and usage data: IP address, device and OS identifiers, app version, push-notification tokens, log/timestamp data, and diagnostics.`,
            `Communications: emails and messages you exchange with us, and your notification preferences.`,
          ]}
        />
      </Section>

      <Section id="use" title="3. How We Use Your Data">
        <List
          items={[
            `Operate the Service: create your account, run contests, form prize pools, and settle results.`,
            `Verify identity and eligibility: perform KYC, confirm age, and confirm your location/jurisdiction.`,
            `Process payments: handle deposits, withdrawals, balances, and related records.`,
            `Prevent fraud and abuse: detect multi-accounting, collusion, money laundering, and prohibited conduct.`,
            `Comply with law: meet anti-money-laundering, tax, record-keeping, and other legal obligations.`,
            `Communicate with you: send transactional emails and, if you opt in, push notifications.`,
            `Improve and secure the Service: diagnostics, analytics, and safeguarding our systems.`,
          ]}
        />
      </Section>

      <Section id="bases" title="4. Legal Bases for Processing (GDPR/UK)">
        <P>{`Where the GDPR or UK GDPR applies, we rely on the following legal bases under Article 6:`}</P>
        <List
          items={[
            `Performance of a contract (Art. 6(1)(b)): to provide the Service you request, including running contests and processing payments.`,
            `Legal obligation (Art. 6(1)(c)): to meet KYC/AML, tax, and record-keeping requirements.`,
            `Legitimate interests (Art. 6(1)(f)): to prevent fraud, secure the Service, and improve our products, balanced against your rights.`,
            `Consent (Art. 6(1)(a)): for optional push notifications and any processing that requires consent; you may withdraw consent at any time.`,
          ]}
        />
        <P>{`Where we process special-category data (such as biometric data used in identity verification), we rely on an additional Article 9 condition where required.`}</P>
        <Flag>
          ATTORNEY: confirm applicability of GDPR/UK GDPR, the correct Art. 6 bases per
          purpose, and the Art. 9 condition for any biometric/identity processing.
        </Flag>
      </Section>

      <Section id="sharing" title="5. Sharing & Sub-Processors">
        <P>
          {`We share personal information with the independent third-party service providers below, each of which processes data for the stated purpose under its own privacy practices. We do not sell your personal information for money.`}
        </P>
        <ul className="space-y-3 text-sm leading-relaxed text-[var(--text-muted)]">
          {SUBPROCESSORS.map((s) => (
            <li key={s.name} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="font-semibold text-[var(--text)]">{s.name}</div>
              <div className="mt-0.5">{s.purpose}</div>
              <div className="mt-1 text-xs">
                Policy: <Ph>{s.url}</Ph>
              </div>
            </li>
          ))}
        </ul>
        <P>
          {`We may also disclose information to law enforcement, regulators, or other parties when we believe in good faith it is required by law, legal process, or to protect the rights, safety, or property of users, the public, or us; and in connection with a merger, acquisition, or sale of assets, subject to this Policy.`}
        </P>
        <Flag>
          ATTORNEY: confirm the sub-processor list is complete and accurate, including any
          real-money geolocation-verification vendor once wired (currently scaffolded but
          not in production), and any analytics/error-reporting tools added later.
        </Flag>
      </Section>

      <Section id="kyc" title="6. Sensitive Data & Identity (KYC)">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`To meet legal obligations and prevent fraud, we (through Didit) collect and verify identity information, which may include government-issued ID images and a selfie or biometric facial match. This information is used to confirm your identity and eligibility, is transmitted securely, and is retained as described in Section 7 (`}
          <Ph>KYC_RETENTION_PERIOD</Ph>
          {`). We restrict internal access to identity data and store related artifacts in access-controlled storage.`}
        </p>
        <Flag>
          ATTORNEY: confirm KYC data-handling, biometric-data notice/consent requirements
          (e.g. BIPA and similar state laws), and the retention/destruction schedule for
          identity documents and biometric identifiers.
        </Flag>
      </Section>

      <Section id="retention" title="7. Data Retention">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`We keep personal information only as long as needed for the purposes described, then delete or anonymize it. Financial and identity records are retained longer where required by anti-money-laundering, tax, and other legal obligations. Our retention schedule by category: `}
          <Ph>RETENTION_PERIODS</Ph>
          {`; identity / KYC records: `}
          <Ph>KYC_RETENTION_PERIOD</Ph>.
        </p>
        <Flag>
          ATTORNEY: confirm retention periods, including statutory minimums for AML/financial
          and tax records, and maximums for biometric/identity data.
        </Flag>
      </Section>

      <Section id="security" title="8. Security">
        <P>
          {`We use technical and organizational safeguards including encryption in transit (TLS), encryption at rest, role-based access controls, and database-level row security. No method of transmission or storage is perfectly secure. If a breach affecting your personal information occurs, we will notify you and regulators as required by applicable law.`}
        </P>
      </Section>

      <Section id="transfers" title="9. International Data Transfers">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`We operate the Service from, and store data in, the United States. Our sub-processors may process data in the United States and elsewhere. If you access the Service from outside the United States, your information will be transferred to and processed in the United States, which may have different data-protection laws than your country.`}{" "}
          <Flag inline>
            ATTORNEY: confirm transfer mechanisms (e.g. SCCs, UK IDTA, adequacy) and any
            required transfer-impact disclosures for EU/UK users.
          </Flag>
        </p>
      </Section>

      <Section id="children" title="10. Children">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`The Service is not directed to, and we do not knowingly collect personal information from, anyone under `}
          <Ph>MIN_AGE</Ph>
          {`. If you believe someone under that age has provided us information, contact `}
          <Ph>PRIVACY_EMAIL</Ph>
          {` and we will delete it.`}
        </p>
      </Section>

      <Section id="rights" title="11. Your Privacy Rights (CCPA/CPRA & GDPR/UK)">
        <P>{`Depending on where you live, you may have some or all of the following rights:`}</P>
        <P>{`California (CCPA/CPRA): the right to know/access the personal information we collect, use, and disclose; the right to delete; the right to correct; the right to opt out of the "sale" or "sharing" of personal information; the right to limit use of sensitive personal information; and the right not to receive discriminatory treatment for exercising your rights.`}</P>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`Do Not Sell or Share: We do not sell your personal information for money. `}
          <Flag inline>
            {`ATTORNEY: confirm whether any disclosure constitutes a "sale" or "sharing" (including for cross-context behavioral advertising or analytics) under CCPA/CPRA, and add an opt-out mechanism if so.`}
          </Flag>
        </p>
        <P>{`EU / UK (GDPR / UK GDPR): the right to access; rectification; erasure; restriction of processing; data portability; objection to processing based on legitimate interests; and withdrawal of consent. You also have the right to lodge a complaint with your supervisory authority.`}</P>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`To exercise any right, contact `}
          <Ph>PRIVACY_EMAIL</Ph>
          {`. We will verify your request and respond within the time required by applicable law. You may use an authorized agent where permitted.`}
        </p>
      </Section>

      <Section id="cookies" title="12. Cookies, SDKs, Analytics & Push Notifications">
        <P>
          {`We use first-party cookies and similar technologies necessary for authentication and session management. We use device/usage diagnostics and app analytics (including services provided by Apple) to operate and improve the Service. We do not use third-party advertising cookies.`}
        </P>
        <P>
          {`If you opt in to push notifications, we use Firebase Cloud Messaging (Google) to deliver them and store a device push token. You can turn off push notifications at any time in your device settings.`}
        </P>
        <Flag>
          ATTORNEY: confirm the cookie/SDK inventory and disclosures, and update if any
          third-party analytics or advertising SDKs are added.
        </Flag>
      </Section>

      <Section id="changes" title="13. Changes & Effective Date">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`We may update this Privacy Policy from time to time. If we make material changes, we will provide notice through the Service or by email. The effective date below reflects the latest version. Effective date: `}
          <Ph>EFFECTIVE_DATE</Ph>.
        </p>
      </Section>

      <DraftBanner />

      <p className="pt-2 text-center text-xs text-[var(--text-muted)]">
        <Link href="/" className="hover:text-white hover:underline">
          ← Back
        </Link>
      </p>
    </article>
  );
}

/* ------------------------------------------------------------------ helpers */

function Ph({ children }: { children: string }) {
  return (
    <code className="rounded bg-[var(--primary-lo)]/15 px-1 py-0.5 font-mono text-[0.85em] text-[var(--primary)]">
      [[{children}]]
    </code>
  );
}

function Flag({
  children,
  inline = false,
}: {
  children: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <mark className="rounded bg-[var(--danger)]/15 px-1 py-0.5 font-mono text-[0.8em] text-[var(--danger)]">
        [[{children}]]
      </mark>
    );
  }
  return (
    <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 font-mono text-[0.8em] leading-relaxed text-[var(--danger)]">
      [[{children}]]
    </p>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-[var(--text-muted)]">{children}</p>
  );
}

function Rich({ children }: { children: string }) {
  const parts = children.split(/(\[\[[^\]]*\]\])/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\[\[([^\]]*)\]\]$/);
        if (!m) return <span key={i}>{p}</span>;
        const inner = m[1];
        if (inner.startsWith("ATTORNEY")) {
          return (
            <mark
              key={i}
              className="rounded bg-[var(--danger)]/15 px-1 py-0.5 font-mono text-[0.8em] text-[var(--danger)]"
            >
              [[{inner}]]
            </mark>
          );
        }
        return (
          <code
            key={i}
            className="rounded bg-[var(--primary-lo)]/15 px-1 py-0.5 font-mono text-[0.85em] text-[var(--primary)]"
          >
            [[{inner}]]
          </code>
        );
      })}
    </>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--text-muted)]">
      {items.map((it, i) => (
        <li key={i}>
          <Rich>{it}</Rich>
        </li>
      ))}
    </ul>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 space-y-3 text-sm leading-relaxed text-[var(--text-muted)]"
    >
      <h2 className="font-display text-base font-semibold text-[var(--text)]">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Toc() {
  return (
    <nav
      aria-label="Table of contents"
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Contents
      </div>
      <ol className="mt-3 space-y-1.5 text-sm">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="text-[var(--text-muted)] hover:text-[var(--primary)] hover:underline"
            >
              {s.n}. {s.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function ConfigBlock() {
  const rows: [string, string][] = [
    ["COMPANY_LEGAL_NAME", "Full legal name of the data controller / operator."],
    ["COMPANY_ADDRESS", "Registered mailing address of the controller."],
    ["PRIVACY_EMAIL", "Email for privacy requests and questions."],
    ["EU_UK_REPRESENTATIVE", "GDPR/UK Art. 27 representative or DPO, if applicable."],
    ["MIN_AGE", "Minimum age the Service is directed to (18/19/21)."],
    ["RETENTION_PERIODS", "General retention schedule by data category."],
    ["KYC_RETENTION_PERIOD", "Retention period for identity / KYC records."],
    ["EFFECTIVE_DATE", "Effective date of this version."],
    ["SUPABASE_PRIVACY_URL", "Supabase privacy policy URL."],
    ["TRUSTLY_PRIVACY_URL", "Trustly privacy policy URL."],
    ["DIDIT_PRIVACY_URL", "Didit privacy policy URL."],
    ["RESEND_PRIVACY_URL", "Resend privacy policy URL."],
    ["FIREBASE_GOOGLE_PRIVACY_URL", "Google/Firebase privacy policy URL."],
    ["APPLE_PRIVACY_URL", "Apple privacy policy URL."],
    ["VERCEL_PRIVACY_URL", "Vercel privacy policy URL."],
    ["CENSUS_PRIVACY_URL", "US Census Bureau / Geocoder privacy notice URL."],
  ];
  return (
    <aside className="rounded-xl border border-[var(--primary-lo)]/40 bg-[var(--surface)] p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
        Config — fill these placeholders in one place
      </div>
      <dl className="mt-3 space-y-2 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="shrink-0">
              <code className="rounded bg-[var(--primary-lo)]/15 px-1 py-0.5 font-mono text-[var(--primary)]">
                [[{k}]]
              </code>
            </dt>
            <dd className="text-[var(--text-muted)]">{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function DraftBanner() {
  return (
    <div
      role="alert"
      className="rounded-xl border border-[var(--danger)]/50 bg-[var(--danger)]/10 px-4 py-3 text-center text-sm font-semibold text-[var(--danger)]"
    >
      DRAFT — pending review by licensed gaming counsel. Do not publish as-is.
    </div>
  );
}
