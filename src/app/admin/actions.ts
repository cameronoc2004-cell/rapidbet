"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, questions, type Currency } from "@/db/schema";
import { postTransaction } from "@/db/ledger";
import { getCurrentProfileId } from "@/lib/session";
import { ADMIN_PASSWORD, TEAM_NAME } from "@/lib/config";

function requireAdmin(formData: FormData): void {
  const pw = String(formData.get("admin_password") ?? "");
  if (pw !== ADMIN_PASSWORD) {
    redirect("/admin?error=unauthorized");
  }
}

export async function createQuestion(formData: FormData) {
  requireAdmin(formData);
  const userId = await getCurrentProfileId();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const quarter = String(formData.get("quarter") ?? "Q1");
  const gameLabel = String(formData.get("gameLabel") ?? "").trim() || "Game";
  const currency = String(formData.get("currency") ?? "GC") as Currency;
  const buyInAmount = Number(formData.get("buyInAmount") ?? 1);

  if (!title || buyInAmount <= 0) redirect("/admin?error=invalid_input");
  if (currency !== "GC" && currency !== "SC") redirect("/admin?error=invalid_input");
  if (!["Q1", "Q2", "Q3", "Q4", "OT"].includes(quarter))
    redirect("/admin?error=invalid_input");

  await db.insert(questions).values({
    title,
    description,
    team: TEAM_NAME,
    gameLabel,
    quarter: quarter as "Q1" | "Q2" | "Q3" | "Q4" | "OT",
    buyInAmount,
    currency,
    status: "open",
    createdBy: userId ?? null,
  });

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?ok=created");
}

export async function resolveQuestion(formData: FormData) {
  requireAdmin(formData);

  const questionId = Number(formData.get("questionId"));
  const actualValue = Number(formData.get("actualValue"));
  if (!Number.isFinite(questionId) || !Number.isFinite(actualValue)) {
    redirect("/admin?error=invalid_input");
  }

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!question) redirect("/admin?error=not_found");
  if (question.status === "resolved") redirect("/admin?error=already_resolved");

  const allEntries = await db
    .select()
    .from(entries)
    .where(eq(entries.questionId, questionId));

  await db.transaction(async (tx) => {
    if (allEntries.length === 0) {
      await tx
        .update(questions)
        .set({ status: "resolved", actualValue, resolvedAt: new Date() })
        .where(eq(questions.id, questionId));
      return;
    }

    // Closest guess wins; ties split the pot equally. Any remainder coins
    // (from integer division) stay in the house — flagged TODO for later.
    const pot = allEntries.reduce((sum, e) => sum + e.amountPaid, 0);
    let bestDiff = Infinity;
    for (const e of allEntries) {
      const diff = Math.abs(e.guessValue - actualValue);
      if (diff < bestDiff) bestDiff = diff;
    }
    const winners = allEntries.filter(
      (e) => Math.abs(e.guessValue - actualValue) === bestDiff,
    );
    const perWinner = Math.floor(pot / winners.length);

    for (const w of winners) {
      await postTransaction(
        {
          userId: w.userId,
          currency: question.currency as Currency,
          delta: perWinner,
          reason: "payout",
          refType: "question",
          refId: question.id,
        },
        tx,
      );
      await tx.update(entries).set({ wonAmount: perWinner }).where(eq(entries.id, w.id));
    }
    for (const loser of allEntries.filter(
      (e) => Math.abs(e.guessValue - actualValue) !== bestDiff,
    )) {
      await tx.update(entries).set({ wonAmount: 0 }).where(eq(entries.id, loser.id));
    }

    await tx
      .update(questions)
      .set({ status: "resolved", actualValue, resolvedAt: new Date() })
      .where(eq(questions.id, questionId));
  });

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/results");
  redirect("/admin?ok=resolved");
}

export async function closeQuestion(formData: FormData) {
  requireAdmin(formData);
  const questionId = Number(formData.get("questionId"));
  if (!Number.isFinite(questionId)) redirect("/admin?error=invalid_input");
  await db
    .update(questions)
    .set({ status: "closed" })
    .where(eq(questions.id, questionId));
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?ok=closed");
}
