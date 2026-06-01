"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { games, questions, type MoneyKind, type WindowLabel } from "@/db/schema";
import { settleQuestion, voidQuestion, ContestError } from "@/lib/contest";
import { getCurrentProfileId } from "@/lib/session";
import { logAudit } from "@/db/audit";
import { ADMIN_PASSWORD, REAL_MONEY_ENABLED } from "@/lib/config";

function requireAdmin(formData: FormData): void {
  const pw = String(formData.get("admin_password") ?? "");
  if (pw !== ADMIN_PASSWORD) redirect("/admin?error=unauthorized");
}

export async function createGame(formData: FormData) {
  requireAdmin(formData);
  const actor = await getCurrentProfileId();

  const league = String(formData.get("league") ?? "").trim();
  const homeTeam = String(formData.get("homeTeam") ?? "").trim();
  const awayTeam = String(formData.get("awayTeam") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();

  if (!league || !homeTeam || !awayTeam || !startsAt) {
    redirect("/admin?error=invalid_input");
  }

  const [created] = await db
    .insert(games)
    .values({ league, homeTeam, awayTeam, startsAt: new Date(startsAt) })
    .returning();
  await logAudit({
    actorUserId: actor,
    action: "game.create",
    refType: "game",
    refId: created.id,
    payload: { league, homeTeam, awayTeam, startsAt },
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?ok=game_created");
}

export async function createQuestion(formData: FormData) {
  requireAdmin(formData);
  const actor = await getCurrentProfileId();

  const gameId = Number(formData.get("gameId"));
  const statType = String(formData.get("statType") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const window = String(formData.get("window") ?? "Q1") as WindowLabel;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const entryFeeMinor = Math.round(Number(formData.get("entryFeeUsd") ?? 1) * 100);
  const minEntrants = Math.max(2, Number(formData.get("minEntrants") ?? 2));
  const locksAt = String(formData.get("locksAt") ?? "").trim();
  const moneyKind = String(formData.get("moneyKind") ?? "virtual") as MoneyKind;

  if (!gameId || !statType || !subject || !title || !locksAt || entryFeeMinor <= 0) {
    redirect("/admin?error=invalid_input");
  }
  if (moneyKind === "real" && !REAL_MONEY_ENABLED) {
    redirect("/admin?error=real_money_disabled");
  }

  const [created] = await db
    .insert(questions)
    .values({
      gameId,
      statType,
      subject,
      window,
      title,
      description,
      entryFeeMinor,
      moneyKind,
      minEntrants,
      locksAt: new Date(locksAt),
      createdBy: actor ?? null,
    })
    .returning();

  await logAudit({
    actorUserId: actor,
    action: "question.create",
    refType: "question",
    refId: created.id,
    payload: {
      gameId, statType, subject, window, title, entryFeeMinor, moneyKind, minEntrants, locksAt,
    },
  });

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?ok=question_created");
}

export async function settleQuestionAction(formData: FormData) {
  requireAdmin(formData);
  const actor = await getCurrentProfileId();

  const questionId = Number(formData.get("questionId"));
  const officialResult = Number(formData.get("officialResult"));
  if (!Number.isFinite(questionId) || !Number.isFinite(officialResult)) {
    redirect("/admin?error=invalid_input");
  }

  try {
    // TODO(vendor): in Phase 2 the official result MUST come from a licensed
    // sports data feed (Sportradar / Genius Sports) — not from the admin form —
    // for any moneyKind === "real" question.
    await settleQuestion({ questionId, officialResult, actorUserId: actor ?? undefined });
  } catch (e) {
    if (e instanceof ContestError) redirect(`/admin?error=${e.code}`);
    throw e;
  }
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/results");
  revalidatePath("/leaderboard");
  redirect("/admin?ok=settled");
}

export async function voidQuestionAction(formData: FormData) {
  requireAdmin(formData);
  const actor = await getCurrentProfileId();
  const questionId = Number(formData.get("questionId"));
  if (!Number.isFinite(questionId)) redirect("/admin?error=invalid_input");

  try {
    await voidQuestion({
      questionId,
      actorUserId: actor ?? undefined,
      reason: String(formData.get("reason") ?? "manual_void"),
    });
  } catch (e) {
    if (e instanceof ContestError) redirect(`/admin?error=${e.code}`);
    throw e;
  }
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?ok=voided");
}
