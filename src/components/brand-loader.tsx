// The branded loading screen: the RallyPot logo on the app background, with a
// soft entrance + gentle breathing pulse and an indeterminate progress bar.
// Used as the navigation/data loading state (app/loading.tsx) and inside the
// boot overlay (BootLoader) that covers full-page loads. Pure presentational —
// no client hooks — so it renders fine in both server and client trees.
//
// The logo is a transparent, tightly-cropped PNG (public/brand/rallypot-mark.png)
// so it sits cleanly on the dark background and stays crisp when scaled down.
// Reduced motion: the logo and bar hold still (see globals.css).
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
        "flex w-full flex-col items-center justify-center gap-7 " +
        (fullScreen ? "min-h-[100dvh]" : "min-h-[55vh]")
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/rallypot-mark.png"
        alt="RallyPot"
        width={519}
        height={479}
        decoding="async"
        draggable={false}
        className="rb-logo h-auto w-40 select-none sm:w-48"
      />
      <div
        className="relative h-[3px] w-32 overflow-hidden rounded-full bg-[var(--border)]"
        aria-hidden="true"
      >
        <div className="rb-bar-fill bg-[var(--primary)]" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
