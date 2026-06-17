"use client";

import { useEffect, useState } from "react";
import { BrandLoader } from "./brand-loader";

// Full-screen branded overlay that covers the gap on every FULL document load
// — cold start in the browser/PWA, a hard refresh, and the full-page
// navigations the deep-link handler triggers (email confirmation taps). It is
// server-rendered into the initial HTML, so it paints immediately (before JS
// runs) instead of the WebView showing a white flash. Once React hydrates and
// the app is interactive, it fades out and unmounts.
//
// Client-side route changes are NOT covered here — those are handled by
// app/loading.tsx (same BrandLoader) and the PageTransition fade. On native
// cold start the iOS splash sits on top of this and hides via NativeShell.
export function BootLoader() {
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    // Hydrated = the app is interactive. Fade out on the next frame, then
    // unmount after the transition so it never traps taps.
    const raf = requestAnimationFrame(() => setHidden(true));
    const t = setTimeout(() => setRemoved(true), 400);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, []);

  if (removed) return null;

  return (
    <div
      aria-hidden={hidden}
      className={
        "fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)] transition-opacity duration-300 motion-reduce:transition-none " +
        (hidden ? "pointer-events-none opacity-0" : "opacity-100")
      }
    >
      <BrandLoader fullScreen />
    </div>
  );
}
