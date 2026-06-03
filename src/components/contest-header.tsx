import { LiveChip } from "./live-chip";

interface ContestHeaderProps {
  league: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;          // ISO
  status: "scheduled" | "in_progress" | "final" | "cancelled";
  liveLabel?: string | null;
}

export function ContestHeader({
  league,
  homeTeam,
  awayTeam,
  startsAt,
  status,
  liveLabel,
}: ContestHeaderProps) {
  const live = status === "in_progress";
  const chipText =
    liveLabel ??
    (live
      ? "LIVE"
      : status === "scheduled"
      ? `STARTS ${formatStart(startsAt)}`
      : status.toUpperCase());

  return (
    <header className="space-y-3">
      <div className="flex items-center gap-2">
        <a
          href="/"
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] transition-colors hover:text-white"
        >
          ← all events
        </a>
        <span className="text-[var(--text-muted)]">/</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {league}
        </span>
        <LiveChip text={chipText} live={live} />
      </div>
      <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--text)] sm:text-4xl">
        <span className="text-[var(--text-muted)]">{awayTeam}</span>{" "}
        <span className="px-1 text-[var(--text-muted)]">@</span>{" "}
        {homeTeam}
      </h1>
    </header>
  );
}

function formatStart(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
