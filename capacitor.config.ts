import type { CapacitorConfig } from "@capacitor/cli";

// Native iOS shell that loads the live Rallypot deployment in WKWebView.
// We don't ship the JS bundle inside the app — `server.url` points at the
// production domain, so every native build is always up to date as long as
// rallypot.org is up. The webDir is just a stub Capacitor requires.
const config: CapacitorConfig = {
  appId: "org.rallypot.app",
  appName: "Rallypot",
  webDir: "ios-shell",
  server: {
    url: "https://rallypot.org",
    cleartext: false,
    // verify.didit.me hosts the KYC flow we redirect the user to from
    // /verify. Without it in allowNavigation, the WKWebView silently routes
    // Didit through iOS Safari and the in-app "Starting…" button never
    // resolves. With it allowed, Didit's hosted ID + selfie flow runs
    // inline in the WKWebView and the redirect-back to rallypot.org/me
    // stays in-app too.
    allowNavigation: ["*.rallypot.org", "rallypot.org", "verify.didit.me"],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#0A0C0B",
    // Pull-to-refresh feels weird when the page already auto-reloads on focus.
    scrollEnabled: true,
  },
};

export default config;
