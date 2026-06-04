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

// Floating bottom-pill nav, iOS-style. Three segments inside a single
// rounded container. Active segment fills with the primary money-green;
// inactive segments stay muted. Safe-area-inset-bottom keeps the bar above
// the home indicator on iPhone.
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
      className="fixed inset-x-0 bottom-0 z-30 pt-3"
    >
      <div className="mx-auto flex max-w-md justify-center px-4">
        <div className="flex w-full items-stretch gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/95 p-1 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={
                  "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-2 transition-colors " +
                  (active
                    ? "bg-[var(--primary)] text-[var(--bg)]"
                    : "text-[var(--text-muted)] hover:text-white")
                }
              >
                {tab.icon(active)}
                <span className={"text-[10px] font-semibold uppercase tracking-[0.12em] " + (active ? "" : "opacity-90")}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

/* ───────── Icons ───────── */

function EventsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

function ActiveIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
