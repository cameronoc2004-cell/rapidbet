import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { deviceTokens } from "@/db/schema";
import { requireOnboarded } from "@/lib/session";

// Client POSTs { token, platform } here after FCM gives it a registration
// token. We upsert by token; the unique index keeps this idempotent.
export async function POST(req: NextRequest) {
  const session = await requireOnboarded();
  const userId = session.profile!.id;

  let body: { token?: string; platform?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const token = String(body.token ?? "").trim();
  const platform = String(body.platform ?? "web");
  if (!token || !["web", "ios", "android"].includes(platform)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(deviceTokens)
    .where(eq(deviceTokens.token, token))
    .limit(1);
  if (existing.length > 0) {
    // Same token, possibly different user (rare; e.g. shared device). Reassign.
    await db
      .update(deviceTokens)
      .set({ userId, lastSeenAt: new Date() })
      .where(eq(deviceTokens.token, token));
  } else {
    await db
      .insert(deviceTokens)
      .values({ userId, token, platform: platform as "web" | "ios" | "android" });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await requireOnboarded();
  const userId = session.profile!.id;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  await db
    .delete(deviceTokens)
    .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)));
  return NextResponse.json({ ok: true });
}
