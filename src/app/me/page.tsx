import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries } from "@/db/schema";
import { getVerificationStatus, requireOnboarded } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { formatMoney } from "@/lib/format";
import { startVerification } from "@/app/verify/actions";

export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  const session = await requireOnboarded();
  const profile = session.profile!;
  const { virtualMinor } = await getWallet(profile.id);
  const verification = await getVerificationStatus(profile.id);
  const { verify } = await searchParams;
  // verify=1 = the user tapped a locked event; emphasize the card.
  const highlightVerify = verify === "1" && verification.status !== "verified";

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

      <VerificationCard status={verification.status} emphasized={highlightVerify} />

      <section className="grid grid-cols-3 gap-2">
        <HeroStat label="Wins" value={winningEntries.length.toLocaleString()} accent />
        <HeroStat label="Picks" value={myEntries.length.toLocaleString()} />
        <HeroStat label="Won" value={formatMoney(totalWonMinor)} />
      </section>

      <Link
        href="/me/settings"
        className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] transition-colors hover:border-[var(--primary-lo)]"
      >
        <span>Edit profile</span>
        <span className="text-[var(--text-muted)]">→</span>
      </Link>
    </div>
  );
}

function VerificationCard({
  status,
  emphasized,
}: {
  status: "verified" | "pending" | "rejected" | "expired" | "none";
  emphasized: boolean;
}) {
  if (status === "verified") {
    return (
      <section className="flex items-center justify-between rounded-xl border border-[var(--primary-lo)]/40 bg-[var(--primary-lo)]/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--primary)]">
            Verified
          </span>
        </div>
        <span className="text-[var(--primary)]">✓</span>
      </section>
    );
  }

  if (status === "pending") {
    return (
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Verification
        </div>
        <p className="mt-1 text-sm text-[var(--text)]">
          In review — usually under a minute. We&apos;ll let you know.
        </p>
      </section>
    );
  }

  const label =
    status === "rejected"
      ? "Verification didn't pass. Try again — make sure the ID is unobstructed."
      : status === "expired"
      ? "Your verification expired. Re-verify to enter contests."
      : "Complete your profile to enter contests.";
  const buttonText = status === "none" ? "Complete profile" : "Re-verify";

  return (
    <section
      className={
        "rounded-xl border px-4 py-4 " +
        // Emphasized = the user tapped a locked event and got bounced here.
        // ring-2 is a clean 2px halo that actually renders (the previous
        // shadow-[...]/20 was a broken bespoke utility — Tailwind can't
        // parse the /20 opacity modifier when the value is a custom
        // expression containing a CSS variable).
        (emphasized
          ? "border-[var(--primary)] bg-[var(--primary-lo)]/10 ring-2 ring-[var(--primary)]/40"
          : "border-[var(--border)] bg-[var(--surface)]")
      }
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Verification
      </div>
      <p className="mt-1 text-sm text-[var(--text)]">{label}</p>
      <form action={startVerification} className="mt-3">
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40"
        >
          {buttonText}
        </button>
      </form>
    </section>
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
