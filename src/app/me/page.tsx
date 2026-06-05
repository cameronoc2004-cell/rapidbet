import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { requireOnboarded } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const session = await requireOnboarded();
  const profile = session.profile!;
  const { virtualMinor } = await getWallet(profile.id);

  // Three numbers only: picks placed, wins, total won.
  const myEntries = await db.select().from(entries).where(eq(entries.userId, profile.id));
  const winningEntries = myEntries.filter((e) => (e.payoutMinor ?? 0) > 0);
  const totalWonMinor = winningEntries.reduce((s, e) => s + (e.payoutMinor ?? 0), 0);

  return (
    <div className="space-y-6">
      <header className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Profile
        </div>
        <h1 className="mt-1 truncate font-display text-3xl font-bold tracking-tight text-[var(--text)]">
          @{profile.username}
        </h1>
        <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
          Balance{" "}
          <span className="font-mono font-semibold text-[var(--primary)]" data-tabular="true">
            {formatMoney(virtualMinor)}
          </span>
        </p>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <HeroStat label="Wins" value={winningEntries.length.toLocaleString()} accent />
        <HeroStat label="Picks" value={myEntries.length.toLocaleString()} />
        <HeroStat label="Won" value={formatMoney(totalWonMinor)} />
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={
          "mt-1 font-mono text-2xl font-bold tracking-tight " +
          (accent ? "text-[var(--primary)]" : "text-[var(--text)]")
        }
        data-tabular="true"
      >
        {value}
      </div>
    </div>
  );
}
