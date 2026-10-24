import { createClient } from "@supabase/supabase-js";

// Server only (the sync job). It bypasses RLS (row-level security), do not import it in components.
// Creates a Supabase client with the service-role key and no stored session.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
