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
// - sticky bottom-0, not position: fixed. The body is min-h-dvh + flex-col
//   and the tab bar is the last child after a flex-1 <main>; sticky keeps
//   it pinned to the viewport bottom during scroll without overlaying
//   content, and (unlike fixed) it gets pushed up by the iOS software
//   keyboard instead of fighting it.
// - Inner container max-w-3xl mirrors the main content + top bar so the
//   tab bar's tap regions sit under the same column on tablet/desktop.
// - py-3 keeps every tap target ≥ 44×44px (icon ~22 + label + 24px
//   vertical padding).
// - env(safe-area-inset-bottom) padding clears the home indicator.
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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
