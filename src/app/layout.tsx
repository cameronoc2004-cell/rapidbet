import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/top-bar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { PageTransition } from "@/components/page-transition";
import { DeepLinkHandler } from "@/components/deep-link-handler";
import { NativeShell } from "@/components/native-shell";
import { BootLoader } from "@/components/boot-loader";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentSession, getOnboardingStatus } from "@/lib/session";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rallypot — Skill Contests",
  description: "Per-quarter prediction contests. Closest answer wins the pool.",
  metadataBase: new URL("https://rallypot.org"),
  applicationName: "Rallypot",
  appleWebApp: {
    capable: true,
    title: "Rallypot",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false, email: false, address: false },
};

// Root layout reads getCurrentSession() to drive showTabs and the top
// bar's profile chrome. Without force-dynamic, Next.js caches the layout
// tree across navigations and the chrome ends up out of sync with the
// current session (e.g. stale tabs after sign-in or sign-out). With
// force-dynamic the layout re-runs on every request, so the chrome
// reflects whoever is signed in right now.
export const dynamic = "force-dynamic";

export const viewport = {
  themeColor: "#16191D",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The admin area (/admin*) is a separate, web-only surface with its own bare
  // chrome (see app/admin/layout.tsx) — none of the consumer shell. Detect it
  // from the path header set in proxy.ts.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

  // Show the bottom tab bar only for users who are signed in AND fully
  // onboarded (email verified + age 18+ + state allowed). Mid-flow users
  // and logged-out users see no nav so they can't tap into pages that would
  // just redirect them back to /onboarding or /login.
  const session = isAdminArea ? null : await getCurrentSession();
  const showTabs = !!session && getOnboardingStatus(session).complete;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable}`}
    >
      {/*
        App shell.

        html/body don't scroll (overflow:hidden + height:100% in
        globals.css). The shell is a 100dvh flex column. TopBar +
        BottomTabBar are flex siblings of <main>; only <main> scrolls.

        Why this matters: with the previous pattern (fixed top bar
        layered over a scrolling body) iOS rubber-band let the user
        drag the document past the bar, revealing a black gap above
        it. There is no body-level scroll to drag any more — the bar
        is part of the shell, not floating on top of it.
        min-h-0 on <main> is the well-known flexbox gotcha: a flex
        child won't shrink below its content size unless you set it,
        which silently breaks overflow.
      */}
      <body>
        {isAdminArea ? (
          // Admin provides its own layout (app/admin/layout.tsx).
          children
        ) : (
          <>
            <BootLoader />
            <div className="flex h-[100dvh] flex-col overflow-hidden">
              <DeepLinkHandler />
              <NativeShell />
              <TopBar />
              <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div
                  className="mx-auto w-full min-w-0 max-w-3xl px-4 pb-6 pt-3 sm:pt-4 md:max-w-5xl md:px-8 md:pt-6"
                  style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
                >
                  <PageTransition>{children}</PageTransition>
                </div>
                <SiteFooter />
              </main>
              {showTabs && <BottomTabBar />}
            </div>
          </>
        )}
      </body>
    </html>
  );
}
