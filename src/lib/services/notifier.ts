// =============================================================================
// Notifier composes EmailProvider + PushProvider into high-level events. App
// code calls notifier.notifyContestWon(...) and doesn't care which channels
// fire. Per-user prefs (profiles.notify_email / notify_push) gate each side.
// =============================================================================

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EmailProvider, Notifier, PushProvider } from "./types";

interface Deps {
  email: EmailProvider;
  push: PushProvider;
}

async function emailFor(userId: number): Promise<string | null> {
  const [p] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!p || !p.notifyEmail) return null;
  // The address lives in Supabase auth.users — pull it through the admin client.
  const { getSupabaseAdmin } = await import("@/lib/supabase/admin");
  try {
    const { data } = await getSupabaseAdmin().auth.admin.getUserById(p.authUserId);
    return data.user?.email ?? null;
  } catch {
    // Fall back to the current session if running in request context.
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  }
}

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://rapidbet-six.vercel.app";
  return `${base}${path}`;
}

export function createNotifier(deps: Deps): Notifier {
  const { email, push } = deps;

  return {
    async notifyContestWon({ userId, amountMinor, questionTitle }) {
      const addr = await emailFor(userId);
      await Promise.allSettled([
        addr &&
          email.send({
            to: addr,
            template: "contest_won",
            data: { amountMinor, questionTitle, url: appUrl("/results") },
          }),
        push.send({
          userId,
          payload: {
            title: "You won!",
            body: `${formatAmount(amountMinor)} on ${questionTitle}`,
            url: "/results",
          },
        }),
      ]);
    },

    async notifyResultsPosted({ userId, questionTitle, won }) {
      // Losers settle quietly per the UX brief — no push, no email.
      if (!won) return;
      const addr = await emailFor(userId);
      await Promise.allSettled([
        addr &&
          email.send({
            to: addr,
            template: "contest_won",
            data: { amountMinor: 0, questionTitle, url: appUrl("/results") },
          }),
        push.send({
          userId,
          payload: { title: "Results posted", body: questionTitle, url: "/results" },
        }),
      ]);
    },

    async notifyDepositConfirmed({ userId, amountMinor }) {
      const addr = await emailFor(userId);
      await Promise.allSettled([
        addr &&
          email.send({
            to: addr,
            template: "deposit_confirmed",
            data: { amountMinor, url: appUrl("/") },
          }),
        push.send({
          userId,
          payload: {
            title: "Deposit confirmed",
            body: `${formatAmount(amountMinor)} ready to play`,
            url: "/",
          },
        }),
      ]);
    },

    async notifyWithdrawalInitiated({ userId, amountMinor }) {
      const addr = await emailFor(userId);
      if (!addr) return;
      await email.send({
        to: addr,
        template: "withdrawal_initiated",
        data: { amountMinor },
      });
    },

    async notifyWithdrawalCompleted({ userId, amountMinor }) {
      const addr = await emailFor(userId);
      await Promise.allSettled([
        addr &&
          email.send({
            to: addr,
            template: "withdrawal_completed",
            data: { amountMinor },
          }),
        push.send({
          userId,
          payload: {
            title: "Withdrawal settled",
            body: formatAmount(amountMinor),
          },
        }),
      ]);
    },

    async notifyResponsibleGaming({ userId, kind, data }) {
      const addr = await emailFor(userId);
      if (!addr) return;
      await email.send({
        to: addr,
        template:
          kind === "limit_reached"
            ? "rg_limit_reached"
            : "rg_self_exclusion_confirm",
        data: data ?? {},
      });
    },
  };
}

function formatAmount(minor: number): string {
  return `$${(minor / 100).toFixed(2)}`;
}
