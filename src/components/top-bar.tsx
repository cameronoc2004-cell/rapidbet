import Link from "next/link";
import { getCurrentSession, getOnboardingStatus } from "@/lib/session";
import { getWallet } from "@/db/wallet";
import { BalancePill } from "./balance-pill";
import { TopBarWordmark } from "./top-bar-nav";
import { PrimaryNav } from "./primary-nav";
import { ProfileMenu } from "./profile-menu";

// Two-phase chrome:
//   Phase 1 (auth + onboarding) — wordmark only. No hamburger, no balance,
//   no tab bar.
//   Phase 2 (fully onboarded user) — wordmark + ☰ ProfileMenu + balance pill.
//   The BottomTabBar (in layout.tsx) follows the same gate.
export async function TopBar() {
  const session = await getCurrentSession();
  const loggedOut = !session;
  const onboarded = !!session && getOnboardingStatus(session).complete;
  const profile = onboarded ? session.profile! : null;
  const wallet = profile ? await getWallet(profile.id) : null;

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
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-3 py-2 sm:px-4 md:max-w-5xl md:px-8">
        <div className="flex min-w-0 items-center gap-2 md:gap-6">
          <div className="flex min-w-0 items-center gap-1">
            {profile && (
              <ProfileMenu
                notifyEmail={profile.notifyEmail ?? true}
                notifyPush={profile.notifyPush ?? true}
              />
            )}
            <TopBarWordmark tagline="skill contests" />
          </div>
          {profile && <PrimaryNav />}
        </div>
        {profile ? (
          <BalancePill balanceMinor={wallet?.virtualMinor ?? 0} />
        ) : loggedOut ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/login?mode=signup"
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)]"
            >
              Sign up
            </Link>
          </div>
        ) : null}
      </div>
    </header>
  );
}
