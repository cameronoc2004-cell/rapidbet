"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import confetti from "canvas-confetti";
import { formatMoney } from "@/lib/format";

interface WinOverlayProps {
  amountMinor: number;
}

// Gold accent (mirror --primary / --primary-hi in globals.css). Used for the
// confetti burst on a win.
const PRIMARY = "#E4B13C";
const PRIMARY_HI = "#F1C96B";

export function WinOverlay({ amountMinor }: WinOverlayProps) {
  const [open, setOpen] = useState(true);
  const [shown, setShown] = useState(0);
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Count-up from 0 to amount, ease-out cubic. ~900ms.
  useEffect(() => {
    if (!open) return;
    if (reduce) {
      setShown(amountMinor);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(amountMinor * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, amountMinor, reduce]);

  // Confetti burst.
  useEffect(() => {
    if (!open || reduce) return;
    const fire = (origin: { x: number; y: number }, scale: number) =>
      confetti({
        particleCount: Math.floor(70 * scale),
        spread: 70,
        startVelocity: 45,
        ticks: 160,
        gravity: 0.95,
        scalar: 0.9,
        origin,
        colors: [PRIMARY, PRIMARY_HI, "#FFFFFF"],
        disableForReducedMotion: true,
      });
    fire({ x: 0.5, y: 0.45 }, 1);
    const t1 = setTimeout(() => fire({ x: 0.15, y: 0.6 }, 0.6), 120);
    const t2 = setTimeout(() => fire({ x: 0.85, y: 0.6 }, 0.6), 240);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, reduce]);

  // Esc to dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label="You won"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/85 p-6 backdrop-blur-md"
        >
          <motion.div
            initial={reduce ? { scale: 0.96, opacity: 0 } : { scale: 0.9, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-[var(--primary-lo)]/60 bg-[var(--surface)] p-8 text-center shadow-[0_0_60px_-20px_rgba(228,177,60,0.5)]"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--primary)]">
              Winner
            </div>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-[var(--text)]">
              You won
            </h2>

            <div
              className="text-gold-gradient mt-6 font-mono text-5xl font-bold tracking-tight"
              data-tabular="true"
            >
              {formatMoney(shown)}
            </div>

            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Added to your virtual balance.
            </p>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-7 w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--bg)] transition-colors hover:bg-[var(--primary-hi)] hover:ring-2 hover:ring-white/40"
              autoFocus
            >
              Nice
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
