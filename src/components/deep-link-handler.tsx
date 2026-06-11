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
//   webview to it via window.location.assign — full navigation, not
//   router.push, because /auth/callback is a server route and we want
//   the server to see the request fresh with the auth code.
//
// Dedup: on cold-start, BOTH getLaunchUrl() and appUrlOpen fire with
// the same URL. Without dedup the callback runs twice — the first
// exchange consumes the auth code and signs the user out / redirects;
// the second exchange tries to reuse the now-consumed code and fails
// with verify_failed, bouncing the user from /auth/confirmed back to
// /login?error=verify_failed. We persist a per-URL marker in
// sessionStorage (survives the window.location.assign navigation but
// resets at app reload) and short-circuit when we see the same URL
// again.
//
// No-op on web — Capacitor.isNativePlatform() is false there.
const SEEN_PREFIX = "rb_dl:";

function alreadyHandled(url: string): boolean {
  try {
    const key = SEEN_PREFIX + url;
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, String(Date.now()));
    return false;
  } catch {
    // sessionStorage can throw in some private-mode webviews; fall through
    // and accept the duplicate handle. Better to maybe-show an error banner
    // than to never route the link.
    return false;
  }
}

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
          // Already routed in this session? Skip — see header comment.
          if (alreadyHandled(url)) return;
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
      // Also fires on cold-start in addition to getLaunchUrl above — the
      // dedup catches the duplicate.
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
