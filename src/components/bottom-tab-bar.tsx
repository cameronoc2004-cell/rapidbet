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

// iOS-style full-width tab bar flush to the bottom edge of the screen.
// Internal safe-area-inset-bottom keeps icons + labels above the home
// indicator. Active tab is colored green; inactive is muted. No floating
// pill — matches native iOS Tab Bar conventions.
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors " +
                (active ? "text-[var(--primary)]" : "text-[var(--text-muted)] hover:text-white")
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
