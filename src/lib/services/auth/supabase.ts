import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthProvider, AuthUserSummary } from "../types";

class SupabaseAuth implements AuthProvider {
  async getCurrentAuthUser(): Promise<AuthUserSummary | null> {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return {
      authUserId: user.id,
      email: user.email ?? null,
      emailConfirmedAt: user.email_confirmed_at ? new Date(user.email_confirmed_at) : null,
    };
  }
}

export const supabaseAuth: AuthProvider = new SupabaseAuth();
