// Minimal HTML email templates. Dark canvas to match the app aesthetic.
// Keep these inline-styled — most email clients strip <style> tags or refuse
// to load remote CSS.

import { formatMoney } from "@/lib/format";
import type { EmailTemplate } from "../types";

interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

const COLORS = {
  bg: "#0A0C0B",
  surface: "#121614",
  border: "#242B28",
  primary: "#16C784",
  text: "#F2F5F3",
  muted: "#8B948F",
};

function shell(body: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${COLORS.bg};font-family:Inter,Arial,sans-serif;color:${COLORS.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:12px;">
        <tr><td style="padding:32px;">
          <div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:${COLORS.text};">Rapid Bet</div>
          <div style="margin-top:6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${COLORS.muted};">Skill contests</div>
          <div style="margin-top:24px;color:${COLORS.text};font-size:15px;line-height:1.55;">${body}</div>
          <div style="margin-top:32px;padding-top:20px;border-top:1px solid ${COLORS.border};font-size:11px;color:${COLORS.muted};">
            Rapid Bet · Free-to-play. Replies to this address are not monitored.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function btn(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${COLORS.primary};color:${COLORS.bg};text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;font-size:14px;">${label}</a>`;
}

export function buildEmail(
  template: EmailTemplate,
  data: Record<string, unknown>,
): BuiltEmail {
  switch (template) {
    case "email_verification": {
      const url = String(data.url ?? "");
      const body =
        `<p>Confirm your email to finish setting up your account.</p>` +
        `<p style="margin-top:20px;">${btn("Verify email", url)}</p>` +
        `<p style="font-size:12px;color:${COLORS.muted};margin-top:24px;">If you didn't sign up, you can ignore this.</p>`;
      return {
        subject: "Verify your email · Rapid Bet",
        html: shell(body),
        text: `Verify your email: ${url}`,
      };
    }
    case "password_reset": {
      const url = String(data.url ?? "");
      const body =
        `<p>Tap the button to set a new password.</p>` +
        `<p style="margin-top:20px;">${btn("Reset password", url)}</p>` +
        `<p style="font-size:12px;color:${COLORS.muted};margin-top:24px;">The link expires in 30 minutes.</p>`;
      return {
        subject: "Reset your password · Rapid Bet",
        html: shell(body),
        text: `Reset your password: ${url}`,
      };
    }
    case "deposit_confirmed": {
      const amount = formatMoney(Number(data.amountMinor ?? 0));
      const body =
        `<p>Your deposit of <strong>${amount}</strong> is confirmed and ready to play.</p>` +
        `<p style="margin-top:20px;">${btn("Open Rapid Bet", String(data.url ?? "https://rapidbet-six.vercel.app"))}</p>`;
      return {
        subject: `Deposit confirmed: ${amount}`,
        html: shell(body),
        text: `Your deposit of ${amount} is confirmed.`,
      };
    }
    case "withdrawal_initiated": {
      const amount = formatMoney(Number(data.amountMinor ?? 0));
      const body =
        `<p>We started a withdrawal of <strong>${amount}</strong> to your linked bank.</p>` +
        `<p style="font-size:12px;color:${COLORS.muted};margin-top:20px;">Bank transfers typically settle in 1–3 business days.</p>`;
      return {
        subject: `Withdrawal initiated: ${amount}`,
        html: shell(body),
        text: `Withdrawal of ${amount} initiated.`,
      };
    }
    case "withdrawal_completed": {
      const amount = formatMoney(Number(data.amountMinor ?? 0));
      const body = `<p>Your withdrawal of <strong>${amount}</strong> has settled in your bank.</p>`;
      return {
        subject: `Withdrawal complete: ${amount}`,
        html: shell(body),
        text: `Withdrawal of ${amount} settled.`,
      };
    }
    case "contest_won": {
      const amount = formatMoney(Number(data.amountMinor ?? 0));
      const title = String(data.questionTitle ?? "your contest");
      const body =
        `<div style="font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:22px;font-weight:700;">You won!</div>` +
        `<div style="margin-top:6px;font-family:'Space Grotesk',Inter,Arial,sans-serif;font-size:36px;font-weight:700;color:${COLORS.primary};letter-spacing:-0.02em;">${amount}</div>` +
        `<p style="margin-top:20px;">Your closest answer took the pool for <em>${title}</em>.</p>` +
        `<p style="margin-top:20px;">${btn("See results", String(data.url ?? "https://rapidbet-six.vercel.app"))}</p>`;
      return {
        subject: `You won ${amount} · Rapid Bet`,
        html: shell(body),
        text: `You won ${amount} on ${title}.`,
      };
    }
    case "rg_limit_reached": {
      const which = String(data.kind ?? "deposit");
      const body =
        `<p>You've reached your <strong>${which}</strong> limit for this period. New ${which}s are paused.</p>` +
        `<p style="margin-top:16px;font-size:12px;color:${COLORS.muted};">If you need help, see our responsible-gaming resources or contact support.</p>`;
      return {
        subject: `Your ${which} limit was reached`,
        html: shell(body),
        text: `Your ${which} limit was reached for this period.`,
      };
    }
    case "rg_self_exclusion_confirm": {
      const until = data.endsAt ? new Date(String(data.endsAt)).toLocaleDateString() : "until you reverse it";
      const body =
        `<p>Self-exclusion is active <strong>${until === "until you reverse it" ? until : `until ${until}`}</strong>.</p>` +
        `<p style="margin-top:16px;">During this period you can't deposit or enter contests.</p>` +
        `<p style="margin-top:20px;font-size:12px;color:${COLORS.muted};">If you need support, reach out to our care team.</p>`;
      return {
        subject: "Self-exclusion confirmed",
        html: shell(body),
        text: `Self-exclusion confirmed.`,
      };
    }
  }
}
