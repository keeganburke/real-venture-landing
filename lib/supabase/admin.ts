import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Admin (service-role) Supabase client for server-only writes.
// Bypasses RLS. NEVER import this from a client component or expose to browser.
// Used by: /api/whop/webhook, /api/discord/callback
//
// NOTE: lib/supabase/server.ts exports a createAdminClient() with the same
// role (no caching, no detectSessionInUrl flag). Existing callers still use
// that one; this module is the cached client for the webhook path.

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("[supabase/admin] NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceRoleKey) throw new Error("[supabase/admin] SUPABASE_SERVICE_ROLE_KEY is not set");

  cached = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}
