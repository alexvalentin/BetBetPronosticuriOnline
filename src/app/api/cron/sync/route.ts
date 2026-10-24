import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMatchesByDateRange, toRow } from "@/lib/football";
import { refreshAllStandings } from "@/lib/standings";
import { syncFootballLive } from "@/lib/sync-live";

export const dynamic = "force-dynamic"; // never cache this endpoint
export const maxDuration = 60; // seconds allowed for the function on Vercel

// Cron endpoint for football-data.org. Modes (query parameter `mode`):
// mode=upcoming  -> once a day: the schedule of the coming days (3 requests)
// mode=live      -> every few minutes: 1 request, only if there is a match that started and is not finished
// mode=standings -> once a day: the standings of every tracked competition (8 requests)
export async function GET(req: Request) {
  // Only callers that know the secret (cron jobs) may use this endpoint.
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const mode = new URL(req.url).searchParams.get("mode") ?? "live";
  const db = createAdminClient();

  // Standings mode: refresh all tables and stop.
  if (mode === "standings") {
    const refreshed = await refreshAllStandings(db);
    return NextResponse.json({ mode, refreshed });
  }

  // Live mode: `force=1` skips the 4-minute throttle (used for manual runs).
  if (mode === "live") {
    const force = new URL(req.url).searchParams.get("force") === "1";
    return NextResponse.json({ mode, ...(await syncFootballLive(db, force)) });
  }

  // Upcoming mode: download the schedule.
  let matches: Awaited<ReturnType<typeof fetchMatchesByDateRange>> = [];
  if (mode === "upcoming") {
    // The free plan allows at most 10 days per call, so we cover 27 days with 3 successive calls
    // (avoids an empty window during international breaks, when the next club match is further away).
    for (let chunk = 0; chunk < 3; chunk++) {
      const from = new Date(Date.now() + (chunk * 9 - 1) * 86400e3).toISOString().slice(0, 10);
      const to = new Date(Date.now() + (chunk * 9 + 8) * 86400e3).toISOString().slice(0, 10);
      matches.push(...(await fetchMatchesByDateRange(from, to)));
    }
  }

  // Convert to database rows and remove duplicate ids (the 3 date ranges overlap by a day).
  const rows = [...new Map(matches.map(toRow).map((r) => [r.id, r])).values()];

  if (rows.length) {
    const { error } = await db.from("matches").upsert(rows, { onConflict: "id" }); // insert or update by match id
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Award points for matches that are finished (database function).
  const { error: settleError } = await db.rpc("settle_predictions");
  if (settleError) return NextResponse.json({ error: settleError.message }, { status: 500 });

  return NextResponse.json({ mode, fetched: matches.length, saved: rows.length });
}
