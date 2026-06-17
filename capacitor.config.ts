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
    // contentInset:"never" disables WKWebView's automatic top/bottom
    // safe-area insets. With "automatic" iOS adds its own padding on top
    // of our CSS env(safe-area-inset-top), producing a doubled top inset
    // — that was the ~300px black gap above the wordmark on signed-in
    // screens. The app-shell layout (see src/app/layout.tsx) handles
    // safe areas itself via env(); we want the WebView to fill the
    // screen flush so our CSS is the only thing inserting padding.
    contentInset: "never",
    backgroundColor: "#16191D",
    // Pull-to-refresh feels weird when the page already auto-reloads on focus.
    scrollEnabled: true,
    // Prevents iOS's default "page couldn't load" overlay from flashing
    // when the WebView has a brief network hiccup. The native splash takes
    // over on cold-start so the user sees a branded screen instead of a
    // blank WebView while the bundle fetches.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      // Brand-matched splash: same background as the body, no spinner
      // (looks more native), and we manually call hide() once the React
      // tree is mounted instead of letting it auto-dismiss too early.
      backgroundColor: "#16191D",
      launchAutoHide: false,
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      // Dark canvas, light glyphs. Locked so iOS doesn't try to swap it
      // mid-navigation.
      style: "DARK",
      backgroundColor: "#16191D",
      overlaysWebView: true,
    },
  },
};

export default config;
