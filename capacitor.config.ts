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
    allowNavigation: ["*.rallypot.org", "rallypot.org"],
  },
  ios: {
    contentInset: "automatic",
    backgroundColor: "#0A0C0B",
    // Pull-to-refresh feels weird when the page already auto-reloads on focus.
    scrollEnabled: true,
  },
};

export default config;
