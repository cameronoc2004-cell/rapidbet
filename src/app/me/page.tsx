import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, skillScores } from "@/db/schema";
import { isAdmin, requireOnboarded } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { formatMoney } from "@/lib/format";
import { ProfileMenu } from "@/components/profile-menu";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await requireOnboarded();
  const profile = session.profile!;
  const admin = await isAdmin();
  const { virtualMinor } = await getWallet(profile.id);

  // Aggregate everything once and compute fun stats client-side cheap.
  const myEntries = await db.select().from(entries).where(eq(entries.userId, profile.id));
  const settled = myEntries.filter((e) => e.payoutMinor !== null);
  const wins = settled.filter((e) => (e.payoutMinor ?? 0) > 0);
  const totalWonMinor = wins.reduce((s, e) => s + (e.payoutMinor ?? 0), 0);
  const totalStakedMinor = myEntries.reduce((s, e) => s + e.feePaidMinor, 0);
  const winRate = settled.length > 0 ? wins.length / settled.length : 0;
  const bestWinMinor = wins.reduce((m, e) => Math.max(m, e.payoutMinor ?? 0), 0);
  const netMinor = totalWonMinor - totalStakedMinor;

  const skill = await db
    .select({ pct: skillScores.percentileRank, pts: skillScores.pointsAwarded })
    .from(skillScores)
    .where(eq(skillScores.userId, profile.id));
  const totalPoints = skill.reduce((s, r) => s + r.pts, 0);
  const avgPctile = skill.length > 0
    ? skill.reduce((s, r) => s + r.pct, 0) / skill.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Header: hamburger top-left, identity, balance below */}
      <header className="space-y-3">
        <div className="flex items-center justify-between">
          <ProfileMenu
            notifyEmail={profile.notifyEmail ?? true}
            notifyPush={profile.notifyPush ?? true}
            isAdmin={admin}
          />
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Profile
          </div>
        </div>

        <div className="min-w-0">
          <h1 className="truncate font-display text-3xl font-bold tracking-tight text-[var(--text)]">
            @{profile.username}
          </h1>
          <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
            Balance{" "}
            <span className="font-mono font-semibold text-[var(--primary)]" data-tabular="true">
              {formatMoney(virtualMinor)}
            </span>
          </p>
        </div>
      </header>

      {/* Hero stats: Wins · Picks · Won */}
      <section className="grid grid-cols-3 gap-2">
        <HeroStat label="Wins" value={wins.length.toLocaleString()} accent />
        <HeroStat label="Picks" value={myEntries.length.toLocaleString()} />
        <HeroStat label="Won" value={formatMoney(totalWonMinor)} mono />
      </section>

      {/* Secondary fun stats */}
      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Form
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <FunStat
            label="Win rate"
            value={settled.length > 0 ? `${(winRate * 100).toFixed(0)}%` : "—"}
            sub={settled.length > 0 ? `${wins.length} / ${settled.length} settled` : "No settled picks yet"}
          />
          <FunStat
            label="Best win"
            value={bestWinMinor > 0 ? formatMoney(bestWinMinor) : "—"}
            sub={bestWinMinor > 0 ? "single payout" : "Win a pool to set this"}
          />
          <FunStat
            label="Accuracy"
            value={skill.length > 0 ? `${(avgPctile * 100).toFixed(0)}%` : "—"}
            sub={skill.length > 0 ? `avg percentile · ${skill.length} contests` : "Settle a pick to see this"}
          />
          <FunStat
            label="Net"
            value={formatMoney(netMinor)}
            sub={`${formatMoney(totalStakedMinor)} staked`}
            accent={netMinor >= 0}
            danger={netMinor < 0}
          />
        </div>
      </section>

      {/* Skill points footer — small fun summary */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Skill points
          </div>
          <div className="font-mono text-base font-semibold text-[var(--text)]" data-tabular="true">
            {totalPoints.toLocaleString()}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ───────── Stat tiles ───────── */

function HeroStat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={
          "mt-1 font-mono text-2xl font-bold tracking-tight " +
          (accent ? "text-[var(--primary)] " : "text-[var(--text)] ") +
          (mono ? "" : "")
        }
        data-tabular="true"
      >
        {value}
      </div>
    </div>
  );
}

function FunStat({
  label,
  value,
  sub,
  accent,
  danger,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={
          "mt-1 font-mono text-lg font-semibold " +
          (danger
            ? "text-[var(--danger)]"
            : accent
            ? "text-[var(--primary)]"
            : "text-[var(--text)]")
        }
        data-tabular="true"
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-[var(--text-muted)]">{sub}</div>
    </div>
  );
}
