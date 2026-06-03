import { Resend } from "resend";
import { isResendConfigured, services } from "../config";
import { logAudit } from "@/db/audit";
import type { EmailProvider, EmailSendInput } from "../types";
import { buildEmail } from "./templates";

class ResendEmailer implements EmailProvider {
  private client: Resend | null = null;

  private get resend(): Resend {
    if (!this.client) {
      this.client = new Resend(services.resend.apiKey);
    }
    return this.client;
  }

  async send(input: EmailSendInput): Promise<{ vendorRef: string | null; skipped: boolean }> {
    if (!isResendConfigured()) {
      console.warn(
        `[email] RESEND_API_KEY missing — skipping ${input.template} to ${input.to}`,
      );
      await logAudit({
        action: "email.skipped",
        payload: { reason: "not_configured", template: input.template, to: input.to },
      });
      return { vendorRef: null, skipped: true };
    }

    const built = buildEmail(input.template, input.data);

    try {
      const res = await this.resend.emails.send({
        from: services.resend.fromAddress,
        to: input.to,
        subject: built.subject,
        html: built.html,
        text: built.text,
      });
      const vendorRef = res.data?.id ?? null;
      await logAudit({
        action: "email.sent",
        payload: {
          template: input.template,
          to: input.to,
          vendor: "resend",
          vendorRef,
        },
      });
      return { vendorRef, skipped: false };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[email] resend send failed:`, msg);
      await logAudit({
        action: "email.failed",
        payload: { template: input.template, to: input.to, error: msg },
      });
      return { vendorRef: null, skipped: false };
    }
  }
}

export const resendEmailer: EmailProvider = new ResendEmailer();
