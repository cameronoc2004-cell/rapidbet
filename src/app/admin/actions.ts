"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, games, questions, type WindowLabel } from "@/db/schema";
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

  // Server-side dedupe: if the same admin posted an identical title within
  // the last 30 seconds, treat it as a double-click and short-circuit.
  const thirtySecAgo = new Date(Date.now() - 30_000);
  const recentDup = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.title, title),
        gt(questions.createdAt, thirtySecAgo),
      ),
    )
    .limit(1);
  if (recentDup.length > 0) {
    revalidatePath("/admin");
    redirect("/admin?ok=created");
  }

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

// Delete a question. Cascade FKs clean up entries / settlements / skill_scores.
// Refuses if the question is already settled (you'd be erasing a payout's record).
// Use void instead for "cancel this contest, refund everyone".
export async function deleteQuestion(formData: FormData) {
  await requireAdmin();
  const session = await getCurrentSession();
  const actor = session?.profile?.id ?? null;

  const questionId = Number(formData.get("questionId"));
  if (!Number.isInteger(questionId)) redirect("/admin?error=invalid_input");

  const [q] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (!q) redirect("/admin?error=not_found");

  if (q.status === "settled") redirect("/admin?error=cant_delete_settled");

  // If anyone has paid an entry fee, force the void+refund path instead of a hard delete.
  const ents = await db.select().from(entries).where(eq(entries.questionId, questionId)).limit(1);
  if (ents.length > 0) redirect("/admin?error=has_entries_use_void");

  await db.delete(questions).where(eq(questions.id, questionId));
  await logAudit({
    actorUserId: actor,
    action: "question.delete",
    refType: "question",
    refId: questionId,
    payload: { title: q.title },
  });
  revalidatePath("/");
  revalidatePath(`/contest/${q.gameId}`);
  revalidatePath("/admin");
  redirect("/admin?ok=deleted");
}

// Update editable fields on an open question. Locked/settled questions cannot
// be edited (their entrants relied on the displayed terms).
export async function updateQuestion(formData: FormData) {
  await requireAdmin();
  const session = await getCurrentSession();
  const actor = session?.profile?.id ?? null;

  const questionId = Number(formData.get("questionId"));
  if (!Number.isInteger(questionId)) redirect("/admin?error=invalid_input");

  const [q] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (!q) redirect("/admin?error=not_found");
  if (q.status !== "open") redirect("/admin?error=cant_edit_locked");

  const title = String(formData.get("title") ?? "").trim();
  const window = String(formData.get("window") ?? q.window) as WindowLabel;
  const entryFeeUsd = Number(formData.get("entryFeeUsd") ?? q.entryFeeMinor / 100);
  const locksAt = String(formData.get("locksAt") ?? "").trim();

  if (!title) redirect("/admin?error=missing_title");
  if (!locksAt) redirect("/admin?error=missing_locks_at");
  if (!Number.isFinite(entryFeeUsd) || entryFeeUsd <= 0) redirect("/admin?error=invalid_fee");
  if (!["Q1", "Q2", "Q3", "Q4", "OT", "GAME"].includes(window)) redirect("/admin?error=invalid_window");

  // If anyone has entered, only let admin change the title (cosmetic). Lock
  // time and fee are part of the contract they agreed to.
  const hasEntries = (await db.select().from(entries).where(eq(entries.questionId, questionId)).limit(1)).length > 0;
  const next = hasEntries
    ? { title }
    : { title, window, entryFeeMinor: Math.round(entryFeeUsd * 100), locksAt: new Date(locksAt) };

  await db.update(questions).set(next).where(eq(questions.id, questionId));
  await logAudit({
    actorUserId: actor,
    action: "question.update",
    refType: "question",
    refId: questionId,
    payload: { changed: Object.keys(next), hasEntries },
  });
  revalidatePath("/");
  revalidatePath(`/contest/${q.gameId}`);
  revalidatePath("/admin");
  redirect("/admin?ok=updated");
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
