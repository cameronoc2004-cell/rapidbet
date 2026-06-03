import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { services } from "@/lib/services/config";

// Service-role Supabase client. NEVER import into client components — this
// bypasses RLS. Server-side use only.
let cached: SupabaseClient | null = null;
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  if (!services.supabase.url || !services.supabase.serviceKey) {
    throw new Error("Supabase admin client missing url or service key");
  }
  cached = createClient(services.supabase.url, services.supabase.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
