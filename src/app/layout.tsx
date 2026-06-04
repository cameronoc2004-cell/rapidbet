import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/top-bar";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { getCurrentProfile } from "@/lib/session";

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
  // Show the bottom tab bar only for signed-in users; logged-out pages
  // (login, forgot-password, terms, privacy) stay clean.
  const profile = await getCurrentProfile();
  const showTabs = !!profile;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)] overflow-x-hidden">
        <TopBar />
        <main
          className={
            "mx-auto w-full max-w-3xl flex-1 px-4 pt-3 sm:pt-4 min-w-0 " +
            (showTabs ? "pb-28" : "pb-8")
          }
        >
          {children}
        </main>
        {!showTabs && (
          <footer className="border-t border-[var(--border)] safe-bottom">
            <div className="mx-auto flex max-w-3xl items-center justify-center gap-4 px-4 py-4 text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <span>·</span>
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <span>·</span>
              <span>© Rallypot</span>
            </div>
          </footer>
        )}
        {showTabs && <BottomTabBar />}
      </body>
    </html>
  );
}
