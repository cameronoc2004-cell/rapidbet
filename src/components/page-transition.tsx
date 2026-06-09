"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Wraps page content so it fades/lifts in on client-side route changes.
//
// Server-rendered HTML on the FIRST load is shown immediately
// (initial={false}); only client-side navigations from Link / router.push
// trigger the animation. Avoids a hydration flash on page reload.
//
// Chrome is intentionally not wrapped — animating the sticky TopBar or
// BottomTabBar during a route change looks broken. Layout.tsx puts this
// only around <main>'s children.
//
// Honors prefers-reduced-motion: collapses to a plain swap, no motion,
// no fade — same accessible behavior as the rest of the UI.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
        // 220ms with a soft "expo-out" cubic curve — feels iOS-native:
        // arrives quickly, settles softly. Long enough to read as
        // "loading in" but never sluggish.
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
