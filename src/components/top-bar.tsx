import { getCurrentProfile, isAdmin } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { APP_NAME } from "@/lib/config";
import { BalancePill } from "./balance-pill";
import { TopBarWordmark } from "./top-bar-nav";
import { ProfileMenu } from "./profile-menu";

// Minimal TopBar: hamburger ☰ (left) + wordmark + balance pill (right) when
// signed in. The hamburger opens the global settings drawer so it's
// accessible from every tab, not just /me.
export async function TopBar() {
  const profile = await getCurrentProfile();
  const wallet = profile ? await getWallet(profile.id) : null;
  const admin = profile ? await isAdmin() : false;

  return (
    <header
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          {profile && (
            <ProfileMenu
              notifyEmail={profile.notifyEmail ?? true}
              notifyPush={profile.notifyPush ?? true}
              isAdmin={admin}
            />
          )}
          <TopBarWordmark appName={APP_NAME} tagline="skill contests" />
        </div>
        {profile ? <BalancePill balanceMinor={wallet?.virtualMinor ?? 0} /> : null}
      </div>
    </header>
  );
}
