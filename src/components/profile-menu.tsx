"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { NotificationPrefs } from "./notification-prefs";
import { PushToggle } from "./push-toggle";
import { ConfirmAction } from "./confirm-action";
import { logout } from "@/app/(auth)/login/actions";
import { deleteAccount } from "@/app/me/actions";

interface ProfileMenuProps {
  notifyEmail: boolean;
  notifyPush: boolean;
  isAdmin: boolean;
}

// Hamburger button (top-left of the profile page) + slide-from-left drawer.
// Style takes after a typical iOS gaming app side panel — flat rows with
// chevrons, expandable disclosures for the few sections that need them,
// sign-out as a pill at the bottom.
export function ProfileMenu(props: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Need to wait until we're on the client so document.body exists for portal.
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const drawer = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            style={{
              paddingTop: "max(env(safe-area-inset-top), 16px)",
              paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
            }}
            className="fixed inset-y-0 left-0 z-[100] flex w-[88vw] max-w-sm flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--bg)]"
          >
              {/* Close affordance — X top-right, like a sheet */}
              <div className="flex items-center justify-end px-5 pb-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>

              <SectionLabel>Notifications</SectionLabel>
              <Expandable label="Notification settings">
                <div className="space-y-3 px-5 pb-4">
                  <NotificationPrefs
                    notifyEmail={props.notifyEmail}
                    notifyPush={props.notifyPush}
                  />
                  <PushToggle />
                </div>
              </Expandable>

              <SectionLabel>Account</SectionLabel>
              <Expandable label="Account settings">
                <div className="space-y-2 px-5 pb-4">
                  <Link
                    href="/forgot-password"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--primary-lo)]"
                  >
                    <span>Change password</span>
                    <Chevron />
                  </Link>
                  {props.isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--primary-lo)]"
                    >
                      <span>Admin tools</span>
                      <Chevron />
                    </Link>
                  )}
                  <ConfirmAction
                    triggerLabel={
                      <span className="flex items-center justify-between">
                        <span>Delete account</span>
                        <Chevron />
                      </span>
                    }
                    triggerClassName="block w-full rounded-xl border border-[var(--danger)]/40 bg-[var(--surface)] px-4 py-3 text-left text-sm font-medium text-[var(--danger)] transition-colors hover:border-[var(--danger)]"
                    title="Delete your account?"
                    body={
                      <>
                        <p>
                          This permanently deletes your profile, balance, picks,
                          wins, notification tokens, and all account history.
                        </p>
                        <p className="mt-2">This cannot be undone.</p>
                      </>
                    }
                    requireText="DELETE"
                    confirmLabel="Delete forever"
                    destructive
                    action={deleteAccount}
                  />
                </div>
              </Expandable>

              <SectionLabel>Legal</SectionLabel>
              <Row href="/terms" onNav={() => setOpen(false)}>
                Terms of Service
              </Row>
              <Row href="/privacy" onNav={() => setOpen(false)}>
                Privacy Policy
              </Row>

              <div className="mt-auto flex items-center justify-between px-5 pt-6">
                <ConfirmAction
                  triggerLabel="Log out"
                  triggerClassName="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--danger)]/60 hover:text-[var(--danger)]"
                  title="Sign out?"
                  body="You'll need to sign back in to play."
                  confirmLabel="Sign out"
                  action={logout}
                />
                <span className="font-display text-sm font-bold tracking-tight text-[var(--text-muted)]">
                  Rallypot
                </span>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open settings"
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {/* Render the drawer in a portal on document.body so it escapes any
          ancestor stacking context (the TopBar uses backdrop-blur which would
          otherwise trap the z-index). */}
      {mounted ? createPortal(drawer, document.body) : null}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 px-5 pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
      {children}
    </div>
  );
}

function Row({
  href,
  onNav,
  children,
}: {
  href: string;
  onNav: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNav}
      className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5 text-base text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
    >
      <span>{children}</span>
      <Chevron />
    </Link>
  );
}

function Expandable({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border-b border-[var(--border)]">
      <summary className="flex cursor-pointer items-center justify-between px-5 py-3.5 text-base text-[var(--text)] transition-colors hover:bg-[var(--surface)]">
        <span>{label}</span>
        <span className="text-[var(--text-muted)] transition-transform group-open:rotate-90">
          <Chevron />
        </span>
      </summary>
      <div className="bg-[var(--surface)]/30">{children}</div>
    </details>
  );
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--text-muted)]"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
