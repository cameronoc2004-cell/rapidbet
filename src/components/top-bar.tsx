import Link from "next/link";
import { logout } from "@/app/(auth)/login/actions";
import { getCurrentProfile } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { APP_NAME } from "@/lib/config";
import { BalancePill } from "./balance-pill";
import { TopBarNav, TopBarWordmark } from "./top-bar-nav";

// Persistent top bar. Server component for auth + wallet; nav illumination is
// handled by the inner client component (needs usePathname).
export async function TopBar() {
  const profile = await getCurrentProfile();
  const wallet = profile ? await getWallet(profile.id) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <TopBarWordmark appName={APP_NAME} tagline="skill contests" />

        <nav className="flex items-center gap-3">
          {profile ? (
            <>
              <TopBarNav
                links={[
                  { href: "/", label: "Events", exact: true },
                ]}
                username={profile.username}
              />
              <BalancePill balanceMinor={wallet?.virtualMinor ?? 0} />
              <form action={logout}>
                <button
                  type="submit"
                  className="text-xs text-[var(--text-muted)] transition-colors hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
