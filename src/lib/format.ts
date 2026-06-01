// Single source for money rendering. Minor units (cents) -> "$X.XX".
// In Phase 1 the display reads from virtualBalance but the format is identical.
// Always pair calls with class="font-mono" or `data-tabular="true"` so digits
// line up when they change.
export function formatMoney(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const dollars = Math.floor(abs / 100);
  const cents = (abs % 100).toString().padStart(2, "0");
  const formattedDollars = dollars.toLocaleString("en-US");
  return `${negative ? "-" : ""}$${formattedDollars}.${cents}`;
}

// Compact form for tight UI (e.g. event card chips). $24.00 -> $24, $1.50 -> $1.50.
export function formatMoneyShort(minor: number): string {
  if (minor % 100 === 0) return `$${(minor / 100).toLocaleString("en-US")}`;
  return formatMoney(minor);
}
