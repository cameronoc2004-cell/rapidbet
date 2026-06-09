"use client";

import { useEffect } from "react";

// Routes incoming Universal Links into the in-app webview.
//
// Without this, iOS launching the app via a rallypot.org Universal Link
// (e.g. the email-confirmation tap from Mail) opens the Rallypot app but
// the webview just sits on whatever page was last loaded — typically /
// or /login. The user sees the home screen instead of the verification
// callback they came from.
//
// Flow:
// - On mount, call App.getLaunchUrl() to catch the cold-start case
//   where the app was killed and launched by tapping the link.
// - Subscribe to App.appUrlOpen for the warm-start case (app was
//   backgrounded; tap brought it to foreground).
// - In both cases, take the URL's path + query and navigate the
//   webview to it. Full navigation (window.location.assign) rather
//   than router.push, because /auth/callback is a server route and
//   we want the server to see the request fresh with the auth code.
//
// No-op on web — Capacitor.isNativePlatform() is false there.
export function DeepLinkHandler() {
  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      const cap = (
        window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
      ).Capacitor;
      if (!cap?.isNativePlatform?.()) return;

      const { App } = await import("@capacitor/app");

      const navigate = (url: string) => {
        try {
          const u = new URL(url);
          // Only follow rallypot.org links — defensive against spoofed
          // schemes that managed to reach us.
          if (!u.hostname.endsWith("rallypot.org")) return;
          // If the link points at the page we're already on, skip the
          // navigation to avoid a reload loop.
          if (u.pathname + u.search === window.location.pathname + window.location.search) return;
          window.location.assign(u.pathname + u.search + u.hash);
        } catch {
          // Malformed URL — ignore.
        }
      };

      // Cold start: app was launched by tapping the link.
      const launch = await App.getLaunchUrl();
      if (launch?.url) navigate(launch.url);

      // Warm start: app was already running; foregrounded by the link.
      const handle = await App.addListener("appUrlOpen", (event) => {
        if (event?.url) navigate(event.url);
      });
      unsub = () => {
        void handle.remove();
      };
    })();

    return () => {
      unsub?.();
    };
  }, []);

  return null;
}
