"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LiveChip } from "./live-chip";

export interface EventListItem {
  gameId: number;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startsAt: string;        // ISO
  status: "scheduled" | "in_progress" | "final" | "cancelled";
  liveLabel?: string | null;   // e.g. "LIVE · Q2"
  openQuestions: number;
  playersIn: number;
}

interface EventListProps {
  items: EventListItem[];
}

export function EventList({ items }: EventListProps) {
  if (items.length === 0) {
    return <EmptyEvents />;
  }
  return (
    <ul className="space-y-3">
      {items.map((e, i) => (
        <motion.li
          key={e.gameId}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut", delay: i * 0.05 }}
        >
          <Link
            href={`/contest/${e.gameId}`}
            className="group block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--primary-lo)] focus-visible:border-[var(--primary)]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {e.league}
                </span>
                <LiveChip
                  text={
                    e.liveLabel ??
                    (e.status === "scheduled"
                      ? `STARTS ${formatStart(e.startsAt)}`
                      : e.status.toUpperCase())
                  }
                  live={e.status === "in_progress"}
                />
              </div>
              <div className="font-mono text-[11px] text-[var(--text-muted)]">
                {e.playersIn} in
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--text)]">
                <span className="text-[var(--text-muted)]">{e.awayTeam}</span>{" "}
                <span className="px-1 text-[var(--text-muted)]">@</span>{" "}
                {e.homeTeam}
              </h2>
              <span className="rounded-md border border-[var(--primary-lo)]/40 bg-[var(--primary-lo)]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--primary)]">
                {e.openQuestions} open
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">
                Tap to view contests
              </span>
              <span className="text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]">
                →
              </span>
            </div>
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}

function EmptyEvents() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/60 px-6 py-14 text-center">
      <div className="mx-auto h-2 w-32 rounded-full bg-[var(--surface-2)] rb-shimmer" />
      <div className="mx-auto mt-3 h-2 w-20 rounded-full bg-[var(--surface-2)] rb-shimmer" />
      <p className="mt-6 text-sm text-[var(--text-muted)]">
        No live events right now.
      </p>
    </div>
  );
}

function formatStart(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
