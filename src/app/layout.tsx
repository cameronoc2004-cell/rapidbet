import type { Metadata } from "next";
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/top-bar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
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

export const viewport = {
  themeColor: "#0A0C0B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Show the bottom tab bar only for users who are signed in AND fully
  // onboarded (email verified + age 18+ + state allowed). Mid-flow users
  // and logged-out users see no nav so they can't tap into pages that would
  // just redirect them back to /onboarding or /login.
  const session = await getCurrentSession();
  const showTabs = !!session && getOnboardingStatus(session).complete;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable}`}
    >
      {/*
        Mobile-first viewport plumbing:
        - min-h-dvh (dynamic viewport height) so empty pages fill the
          visible viewport correctly on iOS Safari where the address bar
          shrinks/grows. min-h-screen / 100vh measures the *largest*
          viewport and causes content to bleed under the address bar.
        - overflow-x-hidden is a guard so a mis-sized child can't
          horizontally scroll the page.
        - The body is a flex column; <main> takes flex-1 so the
          BottomTabBar — now a normal-flow sticky sibling — naturally
          sits at the bottom on short pages without needing a magic
          pb-20 offset on every page.
      */}
      <body className="flex min-h-dvh flex-col overflow-x-hidden bg-[var(--bg)] text-[var(--text)]">
        <TopBar />
        <main className="mx-auto w-full max-w-3xl min-w-0 flex-1 px-4 pt-3 sm:pt-4">
          {children}
        </main>
        {/* No global footer — pages that want Terms/Privacy links render
            them inline (see /login). Avoids the duplicate row issue and
            keeps long-form legal pages from rendering a footer that
            duplicates their own copy. */}
        {showTabs && <BottomTabBar />}
      </body>
    </html>
  );
}
