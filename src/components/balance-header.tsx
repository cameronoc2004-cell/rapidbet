import Link from "next/link";
import { logout } from "@/app/(auth)/login/actions";
import { getCurrentProfile } from "@/lib/session";
import { getAllBalances } from "@/db/ledger";
import { TEAM_NAME } from "@/lib/config";

export async function BalanceHeader() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-base font-bold tracking-tight">Rapid Bet</span>
          <span className="hidden text-xs text-neutral-500 sm:inline">
            · {TEAM_NAME}
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {profile ? (
            <>
              <Balances userId={profile.id} />
              <Link
                href="/results"
                className="hidden text-xs text-neutral-600 hover:underline sm:inline dark:text-neutral-300"
              >
                Results
              </Link>
              <span className="hidden text-xs text-neutral-500 sm:inline">
                @{profile.username}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-xs text-neutral-500 hover:underline"
                >
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
        </div>
      </div>
    </header>
  );
}

async function Balances({ userId }: { userId: number }) {
  const { GC, SC } = await getAllBalances(userId);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-300">
        {GC.toLocaleString()} GC
      </span>
      <span className="rounded-full bg-emerald-100 px-2 py-1 font-medium text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300">
        {SC.toLocaleString()} SC
      </span>
    </div>
  );
}
