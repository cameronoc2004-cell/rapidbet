import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { createSupabaseServerClient } from "./supabase/server";

// Returns the app-side profile row for the currently signed-in Supabase user,
// or null if no one is signed in.
export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.authUserId, user.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCurrentProfileId(): Promise<number | null> {
  const p = await getCurrentProfile();
  return p?.id ?? null;
}
