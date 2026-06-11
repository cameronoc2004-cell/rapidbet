"use client";

import { useEffect } from "react";

// Bridges between the React app and the Capacitor native shell. On iOS,
// this is what makes the WebView feel like an iOS app instead of a web
// page in a window:
//
// 1. Hides the native splash screen once React has actually mounted.
//    The splash is shown by the iOS launch process before our JS even
//    runs; without an explicit hide() it auto-dismisses on a timer that
//    is usually shorter than our cold-start fetch, so the user briefly
//    sees a blank WebView. Now the splash stays up until we tell it to
//    go away — same pattern most iOS apps use.
//
// 2. Locks the status bar to a dark canvas + light glyphs and overlays
//    the WebView, so the iOS chrome blends into the top bar instead of
//    showing as a separate band.
//
// 3. No-op on web (Capacitor.isNativePlatform returns false).
//
// Dynamic imports keep the @capacitor/* native plugin code out of the
// browser bundle so the website doesn't ship megabytes of unused
// native bridge.
export function NativeShell() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cap = (
        window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
      ).Capacitor;
      if (!cap?.isNativePlatform?.()) return;

      try {
        const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
          import("@capacitor/splash-screen"),
          import("@capacitor/status-bar"),
        ]);
        if (cancelled) return;

        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setOverlaysWebView({ overlay: true });
        // Brief delay so the first paint settles — without this the
        // hide-fade can land before the actual content, creating a
        // visible flash. 150ms is below the "feels slow" threshold but
        // long enough for React to render.
        await new Promise((r) => setTimeout(r, 150));
        await SplashScreen.hide({ fadeOutDuration: 240 });
      } catch (e) {
        // Plugin missing / not registered: never block the app boot.
        // Worst case the splash auto-dismisses on its iOS timer.
        console.warn("[native-shell] plugin init failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
