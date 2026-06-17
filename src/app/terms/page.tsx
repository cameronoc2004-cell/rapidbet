import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export const metadata = {
  title: `Terms (DRAFT) · ${process.env.NEXT_PUBLIC_APP_NAME ?? "Rallypot"}`,
  robots: { index: false, follow: false },
};

// =============================================================================
// CONFIG / PLACEHOLDER BLOCK — fill every value here, in one place.
// Each [[TOKEN]] below also appears inline in the document text.
// -----------------------------------------------------------------------------
// [[COMPANY_LEGAL_NAME]]              Full legal name of the operating entity.
// [[COMPANY_ADDRESS]]                 Registered mailing address of the operator.
// [[GOVERNING_STATE]]                 US state whose law governs these Terms.
// [[MIN_AGE]]                         Minimum eligibility age (note 18/19/21 varies by state).
// [[EXCLUDED_STATES_AND_COUNTRIES]]   Jurisdictions where paid-entry contests are NOT offered.
// [[SERVICE_FEE_TERMS]]              How the platform service fee / commission is set & disclosed.
// [[BUYIN_TERMS]]                     Buy-in amounts, minimums/maximums, and how they are shown.
// [[DEPOSIT_WITHDRAWAL_TERMS]]        Limits, minimums, processing times, and any fees.
// [[REFUND_POLICY_TERMS]]             When and how buy-ins are refunded (e.g. voided contests).
// [[RESPONSIBLE_GAMING_RESOURCES]]    Helpline(s) / support resources and self-exclusion details.
// [[TAX_REPORTING_TERMS]]            Operator reporting/withholding policy (e.g. 1099 issuance).
// [[ARBITRATION_TERMS]]              Arbitration provider, rules, venue, fees, and opt-out window.
// [[PAYMENT_PROCESSOR]]              Payment processor of record (currently Trustly).
// [[SUPPORT_EMAIL]]                   Support / legal contact email.
// [[EFFECTIVE_DATE]]                  Effective date of this version.
// =============================================================================

const SECTIONS: { id: string; n: number; title: string }[] = [
  { id: "acceptance", n: 1, title: "Acceptance of Terms & Eligibility" },
  { id: "registration", n: 2, title: "Registration & Identity Verification (KYC)" },
  { id: "geography", n: 3, title: "Geographic Restrictions & Location Verification" },
  { id: "contests", n: 4, title: "How Contests Work" },
  { id: "money", n: 5, title: "Deposits, Withdrawals, Holds & Fees" },
  { id: "conduct", n: 6, title: "Prohibited Conduct" },
  { id: "integrity", n: 7, title: "Contest Integrity, Voiding & Outcome Disputes" },
  { id: "responsible", n: 8, title: "Responsible Gaming" },
  { id: "taxes", n: 9, title: "Taxes" },
  { id: "ip", n: 10, title: "Intellectual Property & License" },
  { id: "disclaimers", n: 11, title: "Disclaimers of Warranties" },
  { id: "liability", n: 12, title: "Limitation of Liability" },
  { id: "indemnification", n: 13, title: "Indemnification" },
  { id: "disputes", n: 14, title: "Governing Law & Dispute Resolution" },
  { id: "termination", n: 15, title: "Suspension & Termination" },
  { id: "changes", n: 16, title: "Changes to These Terms" },
  { id: "contact", n: 17, title: "Contact & Effective Date" },
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 py-2 text-[var(--text)]">
      <header className="space-y-1">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Legal · Draft
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Terms &amp; Conditions
        </h1>
        <p className="text-xs text-[var(--text-muted)]">
          Effective: <Ph>EFFECTIVE_DATE</Ph> · Operated by <Ph>COMPANY_LEGAL_NAME</Ph>
        </p>
      </header>

      <ConfigBlock />
      <DraftBanner />

      <Section id="intro" title="Introduction">
        <P>
          {`These Terms & Conditions (the "Terms") form a binding agreement between you and `}
        </P>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          <Ph>COMPANY_LEGAL_NAME</Ph>{" "}
          {`("`}
          {APP_NAME}
          {`", "we", "us", or "our") and govern your access to and use of the `}
          {APP_NAME}{" "}
          {`mobile application, website, and related services (collectively, the "Service"). By creating an account, depositing funds, or entering a contest, you agree to these Terms and to our `}
          <Link href="/privacy" className="text-[var(--primary)] hover:underline">
            Privacy Policy
          </Link>
          {`. If you do not agree, do not use the Service.`}
        </p>
        <P>
          {`Rallypot is a peer-to-peer prediction contest platform. Users pay a fixed buy-in to enter a contest, multiple users contribute to a shared prize pool (the "pot"), and—based on the outcome of their predictions about real sporting events—one or more winners receive the pot, minus an applicable platform service fee. Real money may be deposited, held in your account balance, and withdrawn.`}
        </P>
        <Flag>
          ATTORNEY: confirm the legal characterization of these contests (e.g. game
          of skill, contest of skill, fantasy contest, sweepstakes, or other) and
          adjust terminology throughout. This draft intentionally describes mechanics
          neutrally and makes no characterization.
        </Flag>
      </Section>

      <Toc />

      <Section id="acceptance" title="1. Acceptance of Terms & Eligibility">
        <P>{`By using the Service, you represent and warrant that all of the following are true:`}</P>
        <List
          items={[
            `You are at least [[MIN_AGE]] years of age. [[ATTORNEY: confirm minimum age; it may be 18, 19, or 21 depending on the user's state and the legal characterization of the contests.]]`,
            `You have the legal capacity to enter into a binding contract in your jurisdiction.`,
            `You are accessing the Service from a permitted jurisdiction (see Section 3).`,
            `You are not located in, or a resident of, any jurisdiction listed in [[EXCLUDED_STATES_AND_COUNTRIES]].`,
            `You are not on any government sanctions or prohibited-persons list, and you are not subject to any self-exclusion order or court order that would prohibit your participation.`,
            `You will maintain only one (1) account. One account per person, per device, and per payment instrument is permitted.`,
            `You are using the Service solely for your own personal, non-commercial benefit.`,
          ]}
        />
        <P>{`We may refuse, restrict, suspend, or close any account at our discretion where eligibility cannot be verified or is reasonably in doubt.`}</P>
      </Section>

      <Section id="registration" title="2. Registration & Identity Verification (KYC)">
        <P>
          {`To use the Service you must register an account with accurate, current, and complete information, including your legal name, email address, and date of birth. You are responsible for keeping this information accurate and for safeguarding your login credentials. You must notify us promptly of any unauthorized use of your account.`}
        </P>
        <P>
          {`Before you may deposit, enter paid contests, or withdraw, you may be required to complete identity verification ("KYC"). KYC is performed by our third-party verification provider, Didit, and may require you to submit a government-issued identification document, a photograph or selfie, and other identifying details. By completing KYC you authorize us and Didit to collect and verify this information. See our `}
        </P>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          <Link href="/privacy" className="text-[var(--primary)] hover:underline">
            Privacy Policy
          </Link>
          {` for how identity information is processed and retained.`}
        </p>
        <List
          items={[
            `We may decline to open or may close an account if identity verification fails or cannot be completed.`,
            `We may re-verify your identity at any time, including before processing a withdrawal.`,
            `Providing false, misleading, or another person's information is grounds for immediate termination and forfeiture as permitted by law. [[ATTORNEY: confirm permissible scope of any forfeiture for fraud.]]`,
          ]}
        />
      </Section>

      <Section id="geography" title="3. Geographic Restrictions & Location Verification">
        <P>
          {`Paid-entry contests are offered only in jurisdictions where we have determined they may lawfully be offered. The Service is not available to users located in `}
        </P>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          <Ph>EXCLUDED_STATES_AND_COUNTRIES</Ph>.{" "}
          <Flag inline>
            ATTORNEY: confirm the restricted/excluded jurisdiction list for paid-entry
            contests, including any state-by-state differences and the minimum age in
            each permitted state.
          </Flag>
        </p>
        <P>
          {`We verify your location using device-based signals (including GPS coordinates and, for real-money features, a geolocation-verification provider). You consent to this location checking. You agree not to disguise or misrepresent your location, including through use of a VPN, proxy, or location-spoofing tool. If we cannot confirm you are in a permitted jurisdiction, paid features will be unavailable to you.`}
        </P>
      </Section>

      <Section id="contests" title="4. How Contests Work">
        <List
          items={[
            `Buy-in. Each contest has a fixed entry fee (the "buy-in"). The buy-in is disclosed before you enter. [[BUYIN_TERMS]]`,
            `Prize pool. Buy-ins from all entrants form a shared prize pool (the "pot").`,
            `Winner determination. Outcomes are determined by your predictions about real sporting events and the official statistical results of those events. The entrant(s) whose predictions best satisfy the contest's stated win condition receive the pot. Where a contest provides for ties, the pot is divided as described in that contest's rules.`,
            `Service fee. We retain a platform service fee from the pot or buy-ins. The fee, and the net amount payable to winner(s), are disclosed in connection with the contest. [[SERVICE_FEE_TERMS]]`,
            `Real outcomes govern. Results depend on real-world sporting events and the data we receive about them. We are not a participant in, and do not control, those events.`,
          ]}
        />
        <P>
          {`We do not act as a counterparty to any contest and do not take a position against entrants. We are not responsible for the performance, scheduling, cancellation, or postponement of any sporting event.`}
        </P>
        <Flag>
          ATTORNEY: confirm characterization and any contest-design constraints required
          by the applicable framework (e.g. predominance-of-skill requirements, peer-to-peer
          structure, prohibited contest types).
        </Flag>
      </Section>

      <Section id="money" title="5. Deposits, Withdrawals, Holds & Fees">
        <P>
          {`Deposits and withdrawals are processed by our payment provider, `}
        </P>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          <Ph>PAYMENT_PROCESSOR</Ph>{" "}
          {`(currently Trustly), which may link to your bank account to move funds. By depositing or withdrawing you also agree to the payment provider's applicable terms. `}
          <Ph>DEPOSIT_WITHDRAWAL_TERMS</Ph>
        </p>
        <List
          items={[
            `Your account balance reflects funds available to enter contests or withdraw. Your balance is NOT a bank deposit, is not insured as a bank deposit, and earns no interest.`,
            `We do not lend or invest your balance on your behalf. [[ATTORNEY: confirm how customer funds are held/segregated and any required disclosures.]]`,
            `Deposits and withdrawals may be subject to minimums, maximums, holds, identity re-verification, and processing times. [[DEPOSIT_WITHDRAWAL_TERMS]]`,
            `We may place a hold on, or decline, any transaction we reasonably believe is fraudulent, unauthorized, in violation of these Terms, or required to be held by law.`,
            `Any fees charged by us or the payment provider are disclosed before the transaction completes.`,
            `Refunds, where applicable (for example, for voided contests), are returned to your account balance as described in Section 7. [[REFUND_POLICY_TERMS]]`,
          ]}
        />
      </Section>

      <Section id="conduct" title="6. Prohibited Conduct">
        <P>{`You agree that you will not:`}</P>
        <List
          items={[
            `Engage in fraud, money laundering, or any unlawful activity through the Service;`,
            `Collude with other entrants or coordinate predictions to manipulate outcomes or pools;`,
            `Open or control more than one account ("multi-accounting"), or use another person's identity, payment instrument, or account;`,
            `Use bots, scripts, automation, or any tool to enter, influence, or gain an unfair advantage in contests;`,
            `Attempt to manipulate a contest, a sporting event, or the data used to settle contests;`,
            `Permit any ineligible person (including a minor or a self-excluded person) to use your account;`,
            `Reverse engineer, scrape, copy, or interfere with the Service or its security; or`,
            `Use the Service from any jurisdiction in which it is not authorized.`,
          ]}
        />
        <P>{`Violation may result in voided contests, frozen balances pending investigation, account termination, and reporting to authorities, in each case to the extent permitted by law.`}</P>
      </Section>

      <Section id="integrity" title="7. Contest Integrity, Voiding & Outcome Disputes">
        <List
          items={[
            `We may cancel, void, suspend, or re-settle a contest if a sporting event is cancelled, postponed, abandoned, or rescheduled; if official results are unavailable, delayed, corrected, or disputed; if a data error occurs; or if we detect fraud, collusion, or a violation of these Terms.`,
            `If a contest is voided before settlement, buy-ins are generally returned to participants' balances. [[REFUND_POLICY_TERMS]]`,
            `Contest results are determined using the official statistical results and data sources we designate. Where those sources are corrected after settlement, we may, where reasonable and permitted, re-settle the contest.`,
            `If you believe a contest was settled in error, you must contact us within the time stated in the contest rules or, if none is stated, promptly after settlement. Our determination of contest results and integrity matters is final to the extent permitted by law and subject to Section 14.`,
          ]}
        />
        <Flag>
          {`ATTORNEY: confirm void/refund/re-settlement policy, any required dispute window, and whether our "final determination" language is enforceable in the governing jurisdiction.`}
        </Flag>
      </Section>

      <Section id="responsible" title="8. Responsible Gaming">
        <P>
          {`We want participation to stay fun and within your means. Tools we make available may include voluntary deposit limits, contest-entry limits, cool-off periods, and self-exclusion. When you set a limit or self-exclude, we will apply it as described at the time you set it.`}
        </P>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`If you or someone you know needs help, support resources are available: `}
          <Ph>RESPONSIBLE_GAMING_RESOURCES</Ph>.
        </p>
        <Flag>
          ATTORNEY: confirm required responsible-gaming disclosures, mandatory tools,
          helpline language, and self-exclusion mechanics for each permitted jurisdiction.
        </Flag>
      </Section>

      <Section id="taxes" title="9. Taxes">
        <P>
          {`You are solely responsible for determining, reporting, and paying any taxes that apply to amounts you win or withdraw. We do not provide tax advice.`}
        </P>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`Where required by law, we may collect tax information from you, withhold amounts, and issue tax forms. `}
          <Ph>TAX_REPORTING_TERMS</Ph>{" "}
          <Flag inline>
            ATTORNEY: confirm 1099 issuance thresholds, backup-withholding obligations,
            W-9 collection, and any state reporting requirements.
          </Flag>
        </p>
      </Section>

      <Section id="ip" title="10. Intellectual Property & License">
        <P>
          {`The Service, including its software, design, text, graphics, logos, and trademarks, is owned by us or our licensors and is protected by intellectual-property laws. Subject to these Terms, we grant you a limited, personal, non-exclusive, non-transferable, revocable license to use the Service for its intended purpose. You may not copy, modify, distribute, sell, or create derivative works from the Service except as expressly permitted. Any rights not expressly granted are reserved.`}
        </P>
        <P>
          {`If you submit feedback or suggestions, you grant us a perpetual, royalty-free license to use them without obligation to you.`}
        </P>
      </Section>

      <Section id="disclaimers" title="11. Disclaimers of Warranties">
        <P>
          {`THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE, OR THAT DATA (INCLUDING SPORTING-EVENT RESULTS) WILL BE ACCURATE.`}
        </P>
      </Section>

      <Section id="liability" title="12. Limitation of Liability">
        <P>
          {`TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL. OUR TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID OR WON THROUGH THE SERVICE IN THE THREE (3) MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS ($100).`}
        </P>
        <Flag>
          ATTORNEY: confirm the liability cap, carve-outs, and that the disclaimer/cap are
          enforceable in [[GOVERNING_STATE]] and any consumer-protection jurisdictions involved.
        </Flag>
      </Section>

      <Section id="indemnification" title="13. Indemnification">
        <P>
          {`You agree to indemnify, defend, and hold harmless `}
        </P>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          <Ph>COMPANY_LEGAL_NAME</Ph>{" "}
          {`and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising out of or related to your use of the Service, your violation of these Terms, your violation of any law or third-party right, or information you provide.`}
        </p>
      </Section>

      <Section id="disputes" title="14. Governing Law & Dispute Resolution">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`These Terms are governed by the laws of the State of `}
          <Ph>GOVERNING_STATE</Ph>{" "}
          {`, without regard to its conflict-of-laws rules.`}
        </p>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`Arbitration and class-action waiver: `}
          <Ph>ARBITRATION_TERMS</Ph>{" "}
          <Flag inline>
            ATTORNEY: confirm enforceability of any binding-arbitration clause and
            class-action / jury-trial waiver, the arbitration provider and rules, the
            venue, fee allocation, the mass-arbitration approach, and any required
            consumer opt-out right and notice period.
          </Flag>
        </p>
        <P>
          {`Nothing in this section prevents either party from seeking injunctive relief in a court of competent jurisdiction for intellectual-property or unauthorized-access matters.`}
        </P>
      </Section>

      <Section id="termination" title="15. Suspension & Termination">
        <P>
          {`We may suspend or terminate your access to the Service, freeze your balance pending investigation, or close your account, with or without notice, if we reasonably believe you have violated these Terms, engaged in fraud or prohibited conduct, or where required by law. On lawful closure, we will return any eligible withdrawable balance to you, subject to verification, holds, and applicable law. You may close your account at any time by contacting us; certain records may be retained as described in our Privacy Policy.`}
        </P>
        <Flag>
          ATTORNEY: confirm balance-handling, forfeiture limits, and notice requirements on
          suspension/termination, including for suspected fraud and AML holds.
        </Flag>
      </Section>

      <Section id="changes" title="16. Changes to These Terms">
        <P>
          {`We may update these Terms from time to time. If we make material changes, we will provide notice through the Service or by email to the address associated with your account before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated Terms. If you do not agree, stop using the Service and close your account.`}
        </P>
      </Section>

      <Section id="contact" title="17. Contact & Effective Date">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`Questions about these Terms? Contact `}
          <Ph>COMPANY_LEGAL_NAME</Ph>{" "}
          {`at `}
          <Ph>SUPPORT_EMAIL</Ph>{" "}
          {`or `}
          <Ph>COMPANY_ADDRESS</Ph>.
        </p>
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          {`Effective date: `}
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

// Renders a [[PLACEHOLDER]] token, visually highlighted for reviewers.
function Ph({ children }: { children: string }) {
  return (
    <code className="rounded bg-[var(--primary-lo)]/15 px-1 py-0.5 font-mono text-[0.85em] text-[var(--primary)]">
      [[{children}]]
    </code>
  );
}

// Renders an inline or block [[ATTORNEY: ...]] flag.
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

// Splits "...[[TOKEN]]..." strings so placeholders/flags render highlighted in lists.
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
    ["COMPANY_LEGAL_NAME", "Full legal name of the operating entity."],
    ["COMPANY_ADDRESS", "Registered mailing address of the operator."],
    ["GOVERNING_STATE", "US state whose law governs these Terms."],
    ["MIN_AGE", "Minimum eligibility age (18/19/21 varies by state)."],
    ["EXCLUDED_STATES_AND_COUNTRIES", "Jurisdictions where paid-entry contests are NOT offered."],
    ["SERVICE_FEE_TERMS", "How the platform service fee / commission is set & disclosed."],
    ["BUYIN_TERMS", "Buy-in amounts, minimums/maximums, and how they are shown."],
    ["DEPOSIT_WITHDRAWAL_TERMS", "Limits, minimums, processing times, and any fees."],
    ["REFUND_POLICY_TERMS", "When and how buy-ins are refunded (e.g. voided contests)."],
    ["RESPONSIBLE_GAMING_RESOURCES", "Helpline(s) / support resources and self-exclusion details."],
    ["TAX_REPORTING_TERMS", "Operator reporting/withholding policy (e.g. 1099 issuance)."],
    ["ARBITRATION_TERMS", "Arbitration provider, rules, venue, fees, and opt-out window."],
    ["PAYMENT_PROCESSOR", "Payment processor of record (currently Trustly)."],
    ["SUPPORT_EMAIL", "Support / legal contact email."],
    ["EFFECTIVE_DATE", "Effective date of this version."],
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
