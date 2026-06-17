// Two-tone "RallyPot" wordmark matching the logo lockup: "Rally" in the
// foreground text color, "Pot" in brand gold (--primary). Pure text so it
// stays crisp at any size and needs no image asset. The trophy mark from the
// full logo lives only in the native app icon / splash (see /assets).
//
// Pass a className for sizing/weight (e.g. font-display sizes); the two color
// spans are applied internally. aria-label keeps it read as one word.
export function BrandWordmark({
  className = "",
  baseClassName = "text-[var(--text)]",
}: {
  className?: string;
  baseClassName?: string;
}) {
  return (
    <span className={className} aria-label="RallyPot">
      <span className={baseClassName}>Rally</span>
      <span className="text-[var(--primary)]">Pot</span>
    </span>
  );
}
