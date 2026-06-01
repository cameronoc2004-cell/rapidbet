import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ledgerEntries, skillScores } from "@/db/schema";
import {
  getCurrentSession,
  getOnboardingStatus,
} from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { formatMoney } from "@/lib/format";
import { PLAY_MIN_AGE_YEARS, REAL_MONEY_ENABLED } from "@/lib/config";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (!session.profile) redirect("/login");

  const status = getOnboardingStatus(session);
  const { virtualMinor, realMinor } = await getWallet(session.profile.id);

  const ledger = await db
    .select()
    .from(ledgerEntries)
    .where(eq(ledgerEntries.userId, session.profile.id))
    .orderBy(desc(ledgerEntries.createdAt))
    .limit(50);

  const skill = await db
    .select()
    .from(skillScores)
    .where(eq(skillScores.userId, session.profile.id))
    .orderBy(desc(skillScores.createdAt));

  const totalPoints = skill.reduce((s, r) => s + r.pointsAwarded, 0);
  const avgPctile = skill.length > 0
    ? skill.reduce((s, r) => s + r.percentileRank, 0) / skill.length
    : 0;

  return (
    <div className="space-y-8">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Profile
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-[var(--text)]">
          @{session.profile.username}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {session.authUser.email}
        </p>
      </header>

      {!status.complete && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">
            Action required
          </div>
          <p className="mt-1 text-sm text-[var(--text)]">
            Finish verification to access events.
          </p>
          <Link
            href="/onboarding"
            className="mt-3 inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)]"
          >
            Finish verification →
          </Link>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Virtual balance" value={formatMoney(virtualMinor)} />
        <Stat
          label="Real balance"
          value={REAL_MONEY_ENABLED ? formatMoney(realMinor) : "Phase 2"}
          muted={!REAL_MONEY_ENABLED}
        />
        <Stat label="Skill points" value={String(totalPoints)} />
      </section>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Verification
        </h2>
        <div className="mt-3 space-y-2">
          <VerifRow
            label="Email"
            value={session.authUser.email ?? ""}
            verified={status.emailVerified}
            ctaHref={status.emailVerified ? null : "/onboarding"}
            ctaLabel="Verify"
          />
          <VerifRow
            label={`Age ${PLAY_MIN_AGE_YEARS}+`}
            value={session.profile.dateOfBirth ?? "Not provided"}
            verified={status.ageVerified}
            ctaHref={status.ageVerified ? null : "/onboarding"}
            ctaLabel="Confirm"
          />
          <VerifRow
            label="State"
            value={session.profile.stateCode ?? "Not selected"}
            verified={status.stateVerified}
            ctaHref={status.stateVerified ? null : "/onboarding"}
            ctaLabel="Choose"
          />
        </div>
      </section>

      {/* Bank account section — Phase 1 placeholder. Connecting a bank account
          is part of Phase 2 (real-money mode) and depends on a high-risk
          gaming payment processor; we do not use Stripe / PayPal / Square here. */}
      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Bank account
        </h2>
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-display text-base font-semibold text-[var(--text)]">
                Not connected
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Required to deposit + withdraw real money. Available when
                real-money mode launches.
              </p>
            </div>
            <span className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Phase 2
            </span>
          </div>
          <button
            type="button"
            disabled
            className="mt-4 cursor-not-allowed rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text-muted)]"
          >
            Connect bank account
          </button>
        </div>
      </section>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Skill history
        </h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {skill.length} contests · avg percentile {(avgPctile * 100).toFixed(1)}%
        </p>
        {skill.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            No settled contests yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {skill.slice(0, 20).map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <span className="text-[var(--text)]">
                  Q#{s.questionId} · err{" "}
                  <span className="font-mono">{s.absError.toFixed(2)}</span>
                </span>
                <span className="font-mono text-xs text-[var(--text-muted)]">
                  +{s.pointsAwarded} pts · {(s.percentileRank * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Wallet ledger
        </h2>
        {ledger.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            No wallet activity yet.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <tr>
                <th className="py-2 pr-2">When</th>
                <th className="py-2 pr-2">Reason</th>
                <th className="py-2 pr-2 text-right">Δ</th>
                <th className="py-2 pr-2 text-right">After</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-2 text-[var(--text-muted)]">
                    {new Date(e.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-2 pr-2 text-[var(--text-muted)]">{e.reason}</td>
                  <td
                    className={`py-2 pr-2 text-right font-mono ${
                      e.deltaMinor >= 0 ? "text-[var(--primary)]" : "text-[var(--danger)]"
                    }`}
                  >
                    {e.deltaMinor >= 0 ? "+" : ""}
                    {formatMoney(e.deltaMinor)}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-[var(--text-muted)]">
                    {formatMoney(e.balanceAfterMinor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-lg font-semibold ${
          muted ? "text-[var(--text-muted)]" : "text-[var(--text)]"
        }`}
        data-tabular="true"
      >
        {value}
      </div>
    </div>
  );
}

function VerifRow({
  label,
  value,
  verified,
  ctaHref,
  ctaLabel,
}: {
  label: string;
  value: string;
  verified: boolean;
  ctaHref: string | null;
  ctaLabel: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
        verified
          ? "border-[var(--primary-lo)]/40 bg-[var(--surface)]/80"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div>
        <div className="font-display text-sm font-semibold text-[var(--text)]">{label}</div>
        <div className="font-mono text-xs text-[var(--text-muted)]">{value}</div>
      </div>
      {verified ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
          Verified
        </span>
      ) : ctaHref ? (
        <Link
          href={ctaHref}
          className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)]"
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
