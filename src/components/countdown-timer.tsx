"use client";

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  // ISO timestamp when entries lock.
  locksAt: string;
  // Fires once when the countdown hits zero (or starts below zero).
  onExpire?: () => void;
  // Visual size.
  size?: "sm" | "md";
}

const WARN_THRESHOLD_MS = 30_000;

// Pure countdown display. Mono tabular figures, turns amber under 30s.
// Parent owns what happens at zero — pass onExpire.
export function CountdownTimer({ locksAt, onExpire, size = "md" }: CountdownTimerProps) {
  const [ms, setMs] = useState(() => Math.max(0, new Date(locksAt).getTime() - Date.now()));
  const [fired, setFired] = useState(false);

  useEffect(() => {
    const target = new Date(locksAt).getTime();
    const tick = () => {
      const left = Math.max(0, target - Date.now());
      setMs(left);
      if (left === 0 && !fired) {
        setFired(true);
        onExpire?.();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [locksAt, onExpire, fired]);

  const warning = ms < WARN_THRESHOLD_MS && ms > 0;
  const dead = ms === 0;
  const color = dead
    ? "text-[var(--text-muted)]"
    : warning
    ? "text-amber-400"
    : "text-[var(--text-muted)]";

  return (
    <span
      className={`font-mono ${size === "sm" ? "text-[11px]" : "text-xs"} ${color}`}
      aria-live={warning ? "polite" : "off"}
    >
      {dead ? "LOCKED" : formatRemaining(ms)}
    </span>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${m}:${pad(s)}`;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}
