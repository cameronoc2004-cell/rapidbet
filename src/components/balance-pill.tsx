"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatMoney } from "@/lib/format";

interface BalancePillProps {
  // Authoritative minor-units balance from the server, refetched on navigation.
  balanceMinor: number;
}

// Animated wallet pill. On any change, count up/down to the new value and emit
// a brief green pulse-glow around the pill. Tabular mono digits so the layout
// never reflows during the tween.
export function BalancePill({ balanceMinor }: BalancePillProps) {
  const reduce = useReducedMotion();
  const [displayed, setDisplayed] = useState(balanceMinor);
  const lastRef = useRef(balanceMinor);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (balanceMinor === lastRef.current) return;
    const from = lastRef.current;
    const to = balanceMinor;
    lastRef.current = to;
    setPulseKey((k) => k + 1);

    if (reduce) {
      setDisplayed(to);
      return;
    }

    const start = performance.now();
    const dur = 650;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplayed(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [balanceMinor, reduce]);

  return (
    <motion.div
      key={pulseKey}
      initial={false}
      animate={pulseKey === 0 ? undefined : { scale: [1, 1.04, 1] }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rb-pulse-glow inline-flex items-center gap-1.5 rounded-full border border-[var(--primary-lo)]/70 bg-[var(--surface)] px-3 py-1.5 text-[13px] font-medium leading-none text-[var(--primary)]"
      style={{ animationName: pulseKey === 0 ? "none" : undefined }}
      data-tabular="true"
    >
      <span
        className="font-mono"
        aria-label={`Balance ${formatMoney(displayed)}`}
      >
        {formatMoney(displayed)}
      </span>
    </motion.div>
  );
}
