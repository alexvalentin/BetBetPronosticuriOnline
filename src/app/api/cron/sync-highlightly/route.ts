import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAGUES, fetchMatchesByDate, fetchStandings, toRow } from "@/lib/highlightly";
import { syncHighlightlyLive, keepFinished } from "@/lib/sync-live";
import { MATCH_EXCLUDED } from "@/lib/football";

export const dynamic = "force-dynamic"; // never cache this endpoint
export const maxDuration = 60; // seconds allowed for the function on Vercel

// Cron endpoint for Highlightly. Modes (query parameter `mode`):
// mode=upcoming  -> today + tomorrow (Romania time), for every competition with matches (without Liga 2): 8 requests
// mode=live      -> only the competition+day pairs with a match that started and is not finished in our database: 0-a few requests
// mode=standings -> once a day, one request per competition: 5 requests
// Total per day, in the busiest case: ~10 + live + 5, far below this API's limit of 100.
export async function GET(req: Request) {
  // Only callers that know the secret (cron jobs) may use this endpoint.
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const mode = new URL(req.url).searchParams.get("mode") ?? "live";
  const db = createAdminClient();
  const codes = Object.keys(LEAGUES); // all Highlightly league ids

  // Standings mode: refresh the table of every league.
  if (mode === "standings") {
    const refreshed: string[] = [];
    for (const code of codes) {
      try {
        const data = await fetchStandings(code);
        if (data.length === 0) continue; // we do not overwrite an existing table with an empty one (e.g. knockout phase, no classic table)
        const { error } = await db.from("standings").upsert(
          { league_id: code, season: 2026, league_name: LEAGUES[code], data, updated_at: new Date().toISOString() },
          { onConflict: "league_id,season" }
        );
        if (error) throw new Error(error.message);
        refreshed.push(code);
      } catch (e) {
        // One failing league must not stop the others.
        console.error("hl standings", code, e);
      }
      await new Promise((r) => setTimeout(r, 700)); // short pause between requests
    }
    return NextResponse.json({ mode, refreshed });
  }

  // Live mode: `force=1` skips the 4-minute throttle (used for manual runs).
  if (mode === "live") {
    const force = new URL(req.url).searchParams.get("force") === "1";
    return NextResponse.json({ mode, ...(await syncHighlightlyLive(db, force)) });
  }

  // upcoming: only today and tomorrow, by Romania's date (the site shows only these two days).
  // The final score of yesterday's matches comes from live mode; we no longer query yesterday here.
  const roDay = (offsetDays: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date(Date.now() + offsetDays * 86400e3));
  const days = [0, 1].map(roDay);
  // Every (league, day) pair we must request; excluded leagues are skipped.
  const pairs = codes.filter((c) => !MATCH_EXCLUDED.includes(c)).flatMap((code) => days.map((day) => ({ code, day })));

  let saved = 0;
  for (const { code, day } of pairs) {
    try {
      const matches = await fetchMatchesByDate(code, day);
      // Convert to database rows; never turn an already finished match back into "not finished".
      const { rows } = await keepFinished(db, matches.map((m) => toRow(m, code)));
      if (rows.length) {
        const { error } = await db.from("matches").upsert(rows, { onConflict: "id" });
        if (error) throw new Error(error.message);
        saved += rows.length;
      }
    } catch (e) {
      console.error("hl matches", code, day, e);
    }
  }

  // Award points for matches that are finished.
  const { error: settleError } = await db.rpc("settle_predictions");
  if (settleError) return NextResponse.json({ error: settleError.message }, { status: 500 });

  return NextResponse.json({ mode, requests: pairs.length, saved });
}
