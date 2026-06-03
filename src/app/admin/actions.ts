"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { games, questions, type WindowLabel } from "@/db/schema";
import { settleQuestion, voidQuestion, ContestError } from "@/lib/contest";
import { getCurrentSession, requireAdmin } from "@/lib/session";
import { logAudit } from "@/db/audit";
import { TEAM_NAME } from "@/lib/config";

// Every action is gated by requireAdmin() — emails in ADMIN_EMAILS env.
// 404s on non-admins so the surface is undiscoverable.

export async function createQuestion(formData: FormData) {
  await requireAdmin();
  const session = await getCurrentSession();
  const actor = session?.profile?.id ?? null;

  const title = String(formData.get("title") ?? "").trim();
  const window = String(formData.get("window") ?? "Q1") as WindowLabel;
  const entryFeeUsd = Number(formData.get("entryFeeUsd") ?? 1);
  const locksAt = String(formData.get("locksAt") ?? "").trim();
  const gameIdRaw = String(formData.get("gameId") ?? "").trim();

  if (!title) redirect("/admin?error=missing_title");
  if (!locksAt) redirect("/admin?error=missing_locks_at");
  if (!Number.isFinite(entryFeeUsd) || entryFeeUsd <= 0)
    redirect("/admin?error=invalid_fee");
  if (!["Q1", "Q2", "Q3", "Q4", "OT", "GAME"].includes(window))
    redirect("/admin?error=invalid_window");

  // Resolve the game. If admin picked "new", auto-create a quick one.
  let gameId: number;
  if (gameIdRaw === "new") {
    const newLeague = String(formData.get("newLeague") ?? "Custom").trim() || "Custom";
    const newHome = String(formData.get("newHome") ?? TEAM_NAME).trim() || TEAM_NAME;
    const newAway = String(formData.get("newAway") ?? "Opponent").trim() || "Opponent";
    const [g] = await db
      .insert(games)
      .values({
        league: newLeague,
        homeTeam: newHome,
        awayTeam: newAway,
        startsAt: new Date(),
        status: "in_progress",
      })
      .returning();
    gameId = g.id;
  } else {
    const id = Number(gameIdRaw);
    if (!Number.isInteger(id)) redirect("/admin?error=missing_game");
    gameId = id;
  }

  const [created] = await db
    .insert(questions)
    .values({
      gameId,
      statType: "custom",
      subject: TEAM_NAME,
      window,
      title,
      entryFeeMinor: Math.round(entryFeeUsd * 100),
      moneyKind: "virtual",
      minEntrants: 2,
      locksAt: new Date(locksAt),
      createdBy: actor ?? null,
    })
    .returning();

  await logAudit({
    actorUserId: actor,
    action: "question.create",
    refType: "question",
    refId: created.id,
    payload: { title, window, entryFeeUsd, locksAt, gameId },
  });

  revalidatePath("/");
  revalidatePath(`/contest/${gameId}`);
  revalidatePath("/admin");
  redirect("/admin?ok=created");
}

// Settle + void stay here as exported server actions; the contest page mounts
// them inline via admin-only widgets so /admin can stay pure question-entry.
export async function settleQuestionAction(formData: FormData) {
  await requireAdmin();
  const session = await getCurrentSession();
  const actor = session?.profile?.id ?? undefined;
  const questionId = Number(formData.get("questionId"));
  const officialResult = Number(formData.get("officialResult"));
  if (!Number.isFinite(questionId) || !Number.isFinite(officialResult)) {
    redirect("/?error=invalid_input");
  }
  try {
    await settleQuestion({ questionId, officialResult, actorUserId: actor });
  } catch (e) {
    if (e instanceof ContestError) redirect(`/?error=${e.code}`);
    throw e;
  }
  revalidatePath("/");
  revalidatePath("/results");
}

export async function voidQuestionAction(formData: FormData) {
  await requireAdmin();
  const session = await getCurrentSession();
  const actor = session?.profile?.id ?? undefined;
  const questionId = Number(formData.get("questionId"));
  if (!Number.isFinite(questionId)) redirect("/?error=invalid_input");
  try {
    await voidQuestion({
      questionId,
      actorUserId: actor,
      reason: String(formData.get("reason") ?? "manual_void"),
    });
  } catch (e) {
    if (e instanceof ContestError) redirect(`/?error=${e.code}`);
    throw e;
  }
  revalidatePath("/");
}
