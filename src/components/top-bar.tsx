import Link from "next/link";
import { logout } from "@/app/(auth)/login/actions";
import { getCurrentProfile } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { APP_NAME } from "@/lib/config";
import { BalancePill } from "./balance-pill";

// Persistent top bar on every page. Server component so the wordmark + auth
// state come from the request; BalancePill is a thin client island.
export async function TopBar() {
  const profile = await getCurrentProfile();
  const wallet = profile ? await getWallet(profile.id) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-display text-base font-bold tracking-tight text-[var(--text)]">
            {APP_NAME}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            skill contests
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          {profile ? (
            <>
              <Link
                href="/leaderboard"
                className="hidden text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] sm:inline"
              >
                Leaderboard
              </Link>
              <Link
                href="/me"
                className="hidden text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)] sm:inline"
              >
                @{profile.username}
              </Link>
              <BalancePill balanceMinor={wallet?.virtualMinor ?? 0} />
              <form action={logout}>
                <button
                  type="submit"
                  className="text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)]"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
