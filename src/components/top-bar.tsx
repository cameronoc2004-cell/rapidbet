import { getCurrentSession, getOnboardingStatus, isAdmin } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { APP_NAME } from "@/lib/config";
import { BalancePill } from "./balance-pill";
import { TopBarWordmark } from "./top-bar-nav";
import { ProfileMenu } from "./profile-menu";

// Two-phase chrome:
//   Phase 1 (auth + onboarding) — wordmark only. No hamburger, no balance,
//   no tab bar.
//   Phase 2 (fully onboarded user) — wordmark + ☰ ProfileMenu + balance pill.
//   The BottomTabBar (in layout.tsx) follows the same gate.
export async function TopBar() {
  const session = await getCurrentSession();
  const onboarded = !!session && getOnboardingStatus(session).complete;
  const profile = onboarded ? session.profile! : null;
  const wallet = profile ? await getWallet(profile.id) : null;
  const admin = profile ? await isAdmin() : false;

  return (
    <header
      // Capped safe-top — see comment in globals.css. Without the cap,
      // mobile Safari can briefly inflate the inset and create a giant
      // empty band above the wordmark.
      style={{ paddingTop: "var(--safe-top)" }}
      className="fixed inset-x-0 top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]"
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
