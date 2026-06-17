import { BrandWordmark } from "./brand-wordmark";

// The branded loading screen: a gold spinner ring above the RallyPot
// wordmark, centered on the app background. Used as the navigation/data
// loading state (app/loading.tsx) and inside the boot overlay (BootLoader)
// that covers full-page loads. Pure presentational — no client hooks — so it
// renders fine in both server and client trees.
//
// Reduced motion: the ring stops spinning (motion-reduce:animate-none) but
// stays visible as a static brand mark.
export function BrandLoader({
  fullScreen = false,
  label = "Loading",
}: {
  fullScreen?: boolean;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={
        "flex w-full flex-col items-center justify-center gap-5 " +
        (fullScreen ? "min-h-[100dvh]" : "min-h-[55vh]")
      }
    >
      <span className="relative inline-flex h-12 w-12" aria-hidden="true">
        {/* track */}
        <span className="absolute inset-0 rounded-full border-2 border-[var(--border)]" />
        {/* gold arc that spins */}
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--primary)] border-r-[var(--primary)] motion-reduce:animate-none" />
      </span>
      <BrandWordmark className="font-display text-xl font-bold tracking-tight" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
