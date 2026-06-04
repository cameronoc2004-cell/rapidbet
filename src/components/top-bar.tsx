import { logout } from "@/app/(auth)/login/actions";
import { getCurrentProfile, isAdmin } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { APP_NAME } from "@/lib/config";
import { BalancePill } from "./balance-pill";
import { TopBarNav, TopBarWordmark } from "./top-bar-nav";

// Persistent top bar. Server component for auth + wallet; nav illumination is
// handled by the inner client component (needs usePathname).
export async function TopBar() {
  const profile = await getCurrentProfile();
  const wallet = profile ? await getWallet(profile.id) : null;
  const admin = profile ? await isAdmin() : false;

  return (
    <header
      // pt-[safe-area-inset-top]: pads under the iOS notch when running as PWA / Capacitor
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-3 sm:px-4">
        <TopBarWordmark appName={APP_NAME} tagline="skill contests" />

        <nav className="flex min-w-0 items-center gap-2 sm:gap-3">
          {profile ? (
            <>
              <TopBarNav
                links={[
                  { href: "/", label: "Events", exact: true },
                  ...(admin ? [{ href: "/admin", label: "Admin" }] : []),
                ]}
                username={profile.username}
              />
              <BalancePill balanceMinor={wallet?.virtualMinor ?? 0} />
              <form action={logout}>
                <button
                  type="submit"
                  className="whitespace-nowrap text-xs text-[var(--text-muted)] transition-colors hover:text-white"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
