"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfileId } from "@/lib/session";
import { submitPrediction, ContestError } from "@/lib/contest";
import { InsufficientFundsError } from "@/db/wallet";

export async function submitEntry(formData: FormData) {
  const userId = await getCurrentProfileId();
  if (!userId) redirect("/login");

  const questionId = Number(formData.get("questionId"));
  const predictionValue = Number(formData.get("prediction"));

  try {
    await submitPrediction({ questionId, userId, predictionValue });
  } catch (e) {
    if (e instanceof ContestError) {
      redirect(`/?error=${e.code}`);
    }
    if (e instanceof InsufficientFundsError) {
      redirect(`/?error=insufficient`);
    }
    throw e;
  }

  revalidatePath("/");
  revalidatePath("/me");
  redirect("/?entered=1");
}
