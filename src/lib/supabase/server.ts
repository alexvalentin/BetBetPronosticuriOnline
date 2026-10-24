import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for server components and server actions. It acts as the logged-in user,
// reading and writing the auth session through the request cookies.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read all cookies of the current request.
        getAll() {
          return cookieStore.getAll();
        },
        // Write refreshed session cookies.
        setAll(list: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component: the middleware refreshes the session
          }
        },
      },
    }
  );
}
