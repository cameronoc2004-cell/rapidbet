interface LiveChipProps {
  // Inline label after the dot, e.g. "LIVE · Q2" or "STARTS 7:30 PM".
  text: string;
  live?: boolean;
}

export function LiveChip({ text, live }: LiveChipProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
      {live && (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full bg-[var(--primary)] rb-pulse-dot" />
        </span>
      )}
      {live && <span className="text-[var(--primary)]">{text}</span>}
      {!live && text}
    </span>
  );
}
