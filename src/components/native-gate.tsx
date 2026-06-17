"use client";

import { useEffect } from "react";

// Used on the logged-out landing page. On the web it does nothing, so browser
// visitors see the landing page. Inside the native iOS app it immediately
// redirects to the given route (e.g. /login) — so the app's logged-out flow is
// unchanged and never shows the marketing landing. The native splash is still
// up during this, so there's no visible flash in the app.
export function NativeGate({ redirectTo }: { redirectTo: string }) {
  useEffect(() => {
    const cap = (
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor;
    if (cap?.isNativePlatform?.()) {
      window.location.replace(redirectTo);
    }
  }, [redirectTo]);
  return null;
}
