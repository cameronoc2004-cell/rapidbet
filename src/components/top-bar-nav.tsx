"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  // If true, exact match required (e.g. "/"). Otherwise startsWith.
  exact?: boolean;
}

interface TopBarNavProps {
  links: NavLink[];
  username: string;
}

// Renders the in-bar nav with the active link illuminated white. usePathname
// requires a client boundary, so this is split out from the server TopBar.
export function TopBarNav({ links, username }: TopBarNavProps) {
  const pathname = usePathname();
  const isActive = (l: NavLink) =>
    l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/");

  return (
    <>
      {links.map((l) => {
        const active = isActive(l);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              "hidden text-xs transition-colors sm:inline " +
              (active
                ? "font-semibold text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]")
            }
          >
            {l.label}
          </Link>
        );
      })}
      <Link
        href="/me"
        aria-current={pathname === "/me" ? "page" : undefined}
        className={
          "hidden text-xs transition-colors sm:inline " +
          (pathname === "/me"
            ? "font-semibold text-[var(--text)]"
            : "text-[var(--text-muted)] hover:text-[var(--text)]")
        }
      >
        @{username}
      </Link>
    </>
  );
}

// Also exposes the wordmark side so it can be illuminated when on "/".
export function TopBarWordmark({
  appName,
  tagline,
}: {
  appName: string;
  tagline: string;
}) {
  const pathname = usePathname();
  const onHome = pathname === "/";
  return (
    <Link href="/" className="flex items-baseline gap-2">
      <span
        className={
          "font-display text-base font-bold tracking-tight transition-colors " +
          (onHome ? "text-[var(--text)]" : "text-[var(--text)]")
        }
        aria-current={onHome ? "page" : undefined}
      >
        {appName}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {tagline}
      </span>
    </Link>
  );
}
