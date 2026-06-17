import { getCurrentSession, getOnboardingStatus, isAdmin } from "@/lib/session";
import { getWallet } from "@/db/wallet";
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
      // App-shell sibling — `shrink-0` keeps the bar at its natural
      // height inside the flex column (it never scrolls, never gets
      // squashed). paddingTop = safe-area inset so the wordmark sits
      // just under the iOS status bar. The padding extends the bar's
      // background INTO the notch area, so there's no visible gap above
      // the bar on notched devices.
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      className="shrink-0 border-b border-[var(--border)] bg-[var(--bg)]"
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
          <TopBarWordmark tagline="skill contests" />
        </div>
        {profile ? <BalancePill balanceMinor={wallet?.virtualMinor ?? 0} /> : null}
      </div>
    </header>
  );
}
