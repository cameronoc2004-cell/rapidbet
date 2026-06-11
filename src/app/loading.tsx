// Next.js renders this while any page in the (root) route segment is
// fetching its server data. Without it, the WKWebView shows its default
// blank / "Page unavailable" state during the brief window between the
// sign-in redirect and the home page's data load.
//
// Three pulsing skeleton blocks matched to the typical page layout
// (heading + sub-copy + a card). Honors prefers-reduced-motion via the
// .rb-shimmer class in globals.css.
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading">
      <div className="space-y-3">
        <div className="rb-shimmer h-7 w-40 rounded-md bg-[var(--surface-2)]" />
        <div className="rb-shimmer h-3 w-72 rounded-md bg-[var(--surface-2)]" />
      </div>
      <div className="rb-shimmer h-28 rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
      <div className="rb-shimmer h-28 rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
    </div>
  );
}
