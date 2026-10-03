import { createClient } from "@supabase/supabase-js";

// Doar pe server (jobul de sincronizare). Ocoleste RLS, nu il importa in componente.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
