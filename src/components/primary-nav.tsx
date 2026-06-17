"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Horizontal primary nav shown in the top bar on desktop web (md+). On phones
// — the native app and mobile web — this is hidden and the BottomTabBar carries
// the same destinations, so the app's mobile layout is unchanged.
const LINKS = [
  { href: "/", label: "Events", match: (p: string) => p === "/" || p.startsWith("/contest") },
  { href: "/active-picks", label: "Active", match: (p: string) => p.startsWith("/active-picks") },
  { href: "/me", label: "Profile", match: (p: string) => p.startsWith("/me") },
];

export function PrimaryNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
      {LINKS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              "text-sm transition-colors " +
              (active
                ? "font-semibold text-[var(--primary)]"
                : "text-[var(--text-muted)] hover:text-white")
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
