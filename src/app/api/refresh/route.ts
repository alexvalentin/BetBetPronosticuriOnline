import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncFootballLive, syncHighlightlyLive } from "@/lib/sync-live";

export const dynamic = "force-dynamic"; // never cache this endpoint
export const maxDuration = 60; // seconds allowed for the function on Vercel

// Refresh-on-visit: only for logged-in users. The sync stops by itself when no match is in progress
// or when it ran less than 4 minutes ago, so it does not multiply with the number of visitors.
export async function POST() {
  // Check that the caller is a logged-in user.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Run both live syncs in parallel; one failing does not stop the other.
  const db = createAdminClient();
  const results = await Promise.allSettled([syncFootballLive(db, false), syncHighlightlyLive(db, false)]);
  // Tell the browser whether anything was saved, so it knows if it must reload the page data.
  const updated = results.some((r) => r.status === "fulfilled" && r.value.saved > 0);
  return NextResponse.json({ updated });
}
