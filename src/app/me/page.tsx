import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { skillScores } from "@/db/schema";
import { isAdmin, requireOnboarded } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { formatMoney } from "@/lib/format";
import { PushToggle } from "@/components/push-toggle";
import { NotificationPrefs } from "@/components/notification-prefs";
import { logout } from "@/app/(auth)/login/actions";

const OK_BANNERS: Record<string, string> = {
  password_updated: "Password updated.",
  notif_prefs: "Notification preferences saved.",
};

export const dynamic = "force-dynamic";

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await requireOnboarded();
  const admin = await isAdmin();
  const { ok } = await searchParams;
  const { virtualMinor } = await getWallet(session.profile!.id);

  // Skill points = sum of all per-question awards.
  const skill = await db
    .select({ pointsAwarded: skillScores.pointsAwarded })
    .from(skillScores)
    .where(eq(skillScores.userId, session.profile!.id));
  const totalPoints = skill.reduce((s, r) => s + r.pointsAwarded, 0);

  return (
    <div className="space-y-7">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Profile
        </div>
        <h1 className="mt-1 truncate font-display text-2xl font-bold tracking-tight text-[var(--text)]">
          @{session.profile!.username}
        </h1>
        <p className="mt-1 truncate text-sm text-[var(--text-muted)]">
          {session.authUser.email}
        </p>
      </header>

      {ok && OK_BANNERS[ok] && (
        <p className="rounded-md border border-[var(--primary-lo)]/40 bg-[var(--primary-lo)]/10 px-3 py-2 text-sm text-[var(--primary)]">
          {OK_BANNERS[ok]}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3">
        <Stat label="Balance" value={formatMoney(virtualMinor)} accent />
        <Stat label="Skill points" value={totalPoints.toLocaleString()} />
      </section>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Notifications
        </h2>
        <div className="mt-3 space-y-3">
          <NotificationPrefs
            notifyEmail={session.profile!.notifyEmail ?? true}
            notifyPush={session.profile!.notifyPush ?? true}
          />
          <PushToggle />
        </div>
      </section>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Account
        </h2>
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="font-display text-base font-semibold text-[var(--text)]">
              Password
            </div>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Change your password by email.
            </p>
            <Link
              href="/forgot-password"
              className="mt-3 inline-block rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--primary-lo)] hover:text-white"
            >
              Send reset link
            </Link>
          </div>

          {admin && (
            <Link
              href="/admin"
              className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary-lo)]"
            >
              <div>
                <div className="font-display text-base font-semibold text-[var(--text)]">
                  Admin
                </div>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Post questions, settle, void.
                </p>
              </div>
              <span className="text-[var(--text-muted)]">→</span>
            </Link>
          )}

          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left text-base font-semibold text-[var(--danger)] transition-colors hover:border-[var(--danger)]/60"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>

      <div className="flex justify-center gap-4 pt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        <Link href="/terms" className="hover:text-white">Terms</Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-white">Privacy</Link>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={
          "mt-1 font-mono text-xl font-semibold " +
          (accent ? "text-[var(--primary)]" : "text-[var(--text)]")
        }
        data-tabular="true"
      >
        {value}
      </div>
    </div>
  );
}
