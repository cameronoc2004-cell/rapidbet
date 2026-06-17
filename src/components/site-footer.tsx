import Link from "next/link";
import { BrandWordmark } from "./brand-wordmark";

// Website footer. Desktop-web only (md+): on phones the app uses the bottom
// tab bar and has no room for a footer, so this stays hidden there and the
// mobile/app layout is unchanged.
export function SiteFooter() {
  const year = 2026; // bump when the calendar year changes
  return (
    <footer className="mt-16 hidden border-t border-[var(--border)] md:block">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-8 py-8 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BrandWordmark className="font-display text-base font-bold tracking-tight" />
          <span className="text-[var(--text-tertiary)]">
            © {year} RallyPot
          </span>
        </div>
        <nav className="flex items-center gap-5">
          <Link href="/terms" className="transition-colors hover:text-white">
            Terms
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-white">
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
