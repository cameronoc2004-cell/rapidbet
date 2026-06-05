import { getCurrentProfile } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { APP_NAME } from "@/lib/config";
import { BalancePill } from "./balance-pill";
import { TopBarWordmark } from "./top-bar-nav";

// Minimal TopBar: wordmark + balance pill when signed in. All nav has
// moved to the bottom tab bar; Sign out + Admin live inside /me.
export async function TopBar() {
  const profile = await getCurrentProfile();
  const wallet = profile ? await getWallet(profile.id) : null;

  return (
    <header
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <TopBarWordmark appName={APP_NAME} tagline="skill contests" />
        {profile ? <BalancePill balanceMinor={wallet?.virtualMinor ?? 0} /> : null}
      </div>
    </header>
  );
}
