"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { entries, questions, type Currency } from "@/db/schema";
import { postTransaction, InsufficientFundsError } from "@/db/ledger";
import { getCurrentProfileId } from "@/lib/session";

export async function submitEntry(formData: FormData) {
  const userId = await getCurrentProfileId();
  if (!userId) redirect("/login");

  const questionId = Number(formData.get("questionId"));
  const guess = Number(formData.get("guess"));

  if (!Number.isFinite(questionId) || !Number.isFinite(guess) || guess < 0) {
    redirect("/?error=invalid_guess");
  }

  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  if (!question) redirect("/?error=not_found");
  if (question.status !== "open") redirect("/?error=closed");

  const existing = await db
    .select()
    .from(entries)
    .where(and(eq(entries.questionId, questionId), eq(entries.userId, userId)))
    .limit(1);
  if (existing.length > 0) redirect("/?error=already_entered");

  try {
    await db.transaction(async (tx) => {
      await postTransaction(
        {
          userId,
          currency: question.currency as Currency,
          delta: -question.buyInAmount,
          reason: "entry_buyin",
          refType: "question",
          refId: question.id,
        },
        tx,
      );
      await tx.insert(entries).values({
        questionId,
        userId,
        guessValue: guess,
        amountPaid: question.buyInAmount,
        currency: question.currency,
      });
    });
  } catch (e) {
    if (e instanceof InsufficientFundsError) {
      redirect(`/?error=insufficient_${e.currency}`);
    }
    throw e;
  }

  revalidatePath("/");
  redirect("/?entered=1");
}
