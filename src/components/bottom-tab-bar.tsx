"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tab {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: (active: boolean) => React.ReactNode;
}

const TABS: Tab[] = [
  {
    href: "/",
    label: "Events",
    match: (p) => p === "/" || p.startsWith("/contest"),
    icon: (active) => <EventsIcon active={active} />,
  },
  {
    href: "/active-picks",
    label: "Active",
    match: (p) => p.startsWith("/active-picks"),
    icon: (active) => <ActiveIcon active={active} />,
  },
  {
    href: "/me",
    label: "Profile",
    match: (p) => p.startsWith("/me"),
    icon: (active) => <ProfileIcon active={active} />,
  },
];

// iOS-style full-width tab bar pinned to the bottom edge.
//
// Layout choices:
// - position: fixed bottom-0. Pinned to the viewport edge so the bar can't
//   move during scroll, overscroll, or content reflow — same anchoring as
//   the top bar above. <main> reserves --bottombar-h of bottom padding so
//   content always lives in the unoccupied middle of the viewport.
// - Inner container max-w-3xl mirrors the main content + top bar so the
//   tab bar's tap regions sit under the same column on tablet/desktop.
// - py-3 + min-h-[44px] keep every tap target ≥ 44×44px (Apple HIG).
// - env(safe-area-inset-bottom) padding clears the home indicator.
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]"
      // Same cap rationale as top-bar.tsx — inline min() so Safari can't
      // inflate the inset and grow the bar. Home indicator is ~34px on
      // every modern iPhone; 40px is enough headroom and stops anything
      // weird from happening.
      style={{ paddingBottom: "min(env(safe-area-inset-bottom, 40px), 40px)" }}
    >
      <div className="mx-auto flex max-w-3xl items-stretch">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-3 transition-colors " +
                (active ? "text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-[var(--text)]")
              }
            >
              {tab.icon(active)}
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ───────── Icons (filled when active) ───────── */

function EventsIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

function ActiveIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.6 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill={active ? "currentColor" : "none"} stroke="currentColor" />
      <path d="m8 12 3 3 5-6" stroke={active ? "var(--bg)" : "currentColor"} />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
