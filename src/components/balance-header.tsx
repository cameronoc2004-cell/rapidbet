import Link from "next/link";
import { logout } from "@/app/(auth)/login/actions";
import { getCurrentProfile } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { APP_NAME, REAL_MONEY_ENABLED } from "@/lib/config";

export async function BalanceHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight">{APP_NAME}</span>
          <span className="hidden text-xs text-neutral-500 sm:inline">
            · Free-to-Play
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          {profile ? (
            <>
              <Balances userId={profile.id} />
              <Link href="/leaderboard" className="hidden text-xs text-neutral-600 hover:underline sm:inline dark:text-neutral-300">
                Leaderboard
              </Link>
              <Link href="/me" className="hidden text-xs text-neutral-600 hover:underline sm:inline dark:text-neutral-300">
                @{profile.username}
              </Link>
              <form action={logout}>
                <button type="submit" className="text-xs text-neutral-500 hover:underline">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

async function Balances({ userId }: { userId: number }) {
  const { virtualMinor, realMinor } = await getWallet(userId);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="rounded-full bg-sky-100 px-2 py-1 font-medium text-sky-900 dark:bg-sky-500/15 dark:text-sky-300"
        title="Virtual balance (free-to-play)"
      >
        {formatCents(virtualMinor)} VC
      </span>
      {REAL_MONEY_ENABLED && (
        <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300">
          ${(realMinor / 100).toFixed(2)}
        </span>
      )}
    </div>
  );
}

function formatCents(minor: number): string {
  return (minor / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}
