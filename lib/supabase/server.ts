// Requires these env vars (same names the Studio uses; already present in
// .env.local locally, and must be set in the Vercel project dashboard):
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY   (unused by this client, listed for parity)
//   SUPABASE_SERVICE_ROLE_KEY
import { createClient } from "@supabase/supabase-js";

// Service role client, bypasses RLS.
// NEVER import this in client components or page components.
// Only use in API routes (/app/api/**) for server-side admin operations.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase admin env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
