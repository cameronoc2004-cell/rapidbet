import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { deviceTokens, profiles } from "@/db/schema";
import { logAudit } from "@/db/audit";
import { isFcmConfigured, services } from "../config";
import type { PushPayload, PushProvider } from "../types";

class FcmPusher implements PushProvider {
  private app: App | null = null;

  private get messaging(): Messaging {
    if (!this.app) {
      const cred = services.fcm.serviceAccountJson
        ? cert(JSON.parse(services.fcm.serviceAccountJson))
        : cert({
            projectId: services.fcm.projectId,
            clientEmail: services.fcm.clientEmail,
            privateKey: services.fcm.privateKey,
          });
      this.app = getApps()[0] ?? initializeApp({ credential: cred });
    }
    return getMessaging(this.app);
  }

  async send({
    userId,
    payload,
  }: {
    userId: number;
    payload: PushPayload;
  }): Promise<{ sent: number; pruned: number }> {
    if (!isFcmConfigured()) {
      console.warn(`[push] FCM not configured — skipping send to user ${userId}`);
      await logAudit({
        action: "push.skipped",
        actorUserId: userId,
        payload: { reason: "not_configured", title: payload.title },
      });
      return { sent: 0, pruned: 0 };
    }

    // Respect user prefs.
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    if (!profile?.notifyPush) {
      return { sent: 0, pruned: 0 };
    }

    const tokens = await db
      .select()
      .from(deviceTokens)
      .where(eq(deviceTokens.userId, userId));
    if (tokens.length === 0) return { sent: 0, pruned: 0 };

    let sent = 0;
    const toPrune: string[] = [];

    const res = await this.messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: payload.title, body: payload.body },
      data: {
        ...(payload.url ? { url: payload.url } : {}),
        ...(payload.data ?? {}),
      },
    });

    res.responses.forEach((r, i) => {
      if (r.success) sent += 1;
      else {
        const code = r.error?.code ?? "";
        // FCM tells us which tokens are dead so we can prune.
        if (
          code.includes("registration-token-not-registered") ||
          code.includes("invalid-registration-token") ||
          code.includes("invalid-argument")
        ) {
          toPrune.push(tokens[i].token);
        }
      }
    });

    if (toPrune.length > 0) {
      await db.delete(deviceTokens).where(inArray(deviceTokens.token, toPrune));
    }

    await logAudit({
      action: "push.sent",
      actorUserId: userId,
      payload: {
        title: payload.title,
        tokens: tokens.length,
        sent,
        pruned: toPrune.length,
      },
    });

    return { sent, pruned: toPrune.length };
  }
}

export const fcmPusher: PushProvider = new FcmPusher();
