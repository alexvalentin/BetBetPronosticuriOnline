import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMatchesByDateRange, toRow as footballRow } from "./football";
import { fetchMatchesByDate, toRow as highlightlyRow } from "./highlightly";
import { MATCH_EXCLUDED } from "@/lib/football";
import { refreshDueStandings } from "./standings";

// "Live" synchronisation. It is used both by the cron jobs (Supabase pg_cron, GitHub Actions)
// and by the refresh-on-visit endpoint (/api/refresh).
// No matter who triggers it, it stops by itself when:
//  - there is no match that has started and not finished yet (last 6 hours) -> 0 API requests
//  - it already ran less than 4 minutes ago for the same source (avoids duplicate API calls)
const THROTTLE_MS = 4 * 60e3; // minimum time between two live syncs of the same source
const WINDOW_MS = 6 * 3600e3; // how far back we look for matches that are "in progress"

// Shape of what a live sync returns (useful as the JSON response of the cron endpoints).
export type LiveResult = { skipped?: string; throttled?: boolean; requests?: number; saved: number; standings?: string[] };

// Returns the ids (out of the given ones) that are ALREADY marked as finished in our database.
// We call it BEFORE saving the fresh API data, so we can tell which matches just finished now.
async function finishedIds(db: SupabaseClient, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const { data } = await db.from("matches").select("id").in("id", ids).eq("is_finished", true);
  return new Set((data ?? []).map((r) => r.id as number));
}

// Protection against stale API answers: a match that is ALREADY finished in our database must never be
// written back as "not finished" (the free API sometimes returns old data). Returns the rows that are safe to save,
// plus the set of ids that were finished before this sync.
export async function keepFinished<T extends { id: number; is_finished: boolean }>(db: SupabaseClient, rows: T[]) {
  const was = await finishedIds(db, rows.map((r) => r.id));
  return { rows: rows.filter((r) => r.is_finished || !was.has(r.id)), was };
}

// Stores the moment a match was first seen as finished (used to time the standings refresh after a match).
// Only matches that were NOT finished before this sync are marked (avoids a burst of calls on the first run).
async function markFinished(db: SupabaseClient, rows: { id: number; is_finished: boolean }[], wasFinished: Set<number>) {
  const ids = rows.filter((r) => r.is_finished && !wasFinished.has(r.id)).map((r) => r.id);
  if (!ids.length) return;
  await db.from("matches").update({ finished_at: new Date().toISOString() }).in("id", ids).eq("is_finished", true).is("finished_at", null);
}

// True if any match of this source was updated less than THROTTLE_MS ago (so we can skip the API call).
async function recentlyUpdated(db: SupabaseClient, source: string) {
  const { data } = await db
    .from("matches")
    .select("updated_at")
    .eq("source", source)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? Date.now() - new Date(data.updated_at).getTime() < THROTTLE_MS : false;
}

// Live sync for football-data.org matches (1 API request for all leagues).
async function footballLive(db: SupabaseClient, force: boolean): Promise<LiveResult> {
  const now = Date.now();
  // Count football-data matches that already kicked off (within the last 6 hours) and are not finished.
  const { count } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .neq("source", "highlightly")
    .eq("is_finished", false)
    .lte("kickoff_at", new Date(now).toISOString())
    .gte("kickoff_at", new Date(now - WINDOW_MS).toISOString());
  if (!count) return { skipped: "niciun meci football-data in desfasurare", saved: 0 }; // nothing to update -> no API call
  if (!force && (await recentlyUpdated(db, "football-data"))) return { throttled: true, saved: 0 }; // too soon since last run

  // Fetch yesterday + today + tomorrow (tomorrow so we do not depend on how the API treats the end date),
  // with all statuses, so we also catch a match that has just finished and no longer shows as "in progress".
  const day = (offset: number) => new Date(now + offset * 86400e3).toISOString().slice(0, 10);
  const matches = await fetchMatchesByDateRange(day(-1), day(1));
  // Convert API matches to database rows and remove duplicate ids.
  const all = [...new Map(matches.map(footballRow).map((r) => [r.id, r])).values()];
  // Drop rows that would turn an already finished match back into "not finished"; `was` = ids finished before this sync.
  const { rows, was } = await keepFinished(db, all);
  if (rows.length) {
    const { error } = await db.from("matches").upsert(rows, { onConflict: "id" }); // insert or update by match id
    if (error) throw new Error(error.message);
    await markFinished(db, rows, was); // timestamp the newly finished matches
  }
  // Award points for finished matches (database function).
  const { error: settleError } = await db.rpc("settle_predictions");
  if (settleError) throw new Error(settleError.message);
  return { requests: 1, saved: rows.length };
}

// Live sync for Highlightly matches (1 API request per league+day combination that has a match in progress).
async function highlightlyLive(db: SupabaseClient, force: boolean): Promise<LiveResult> {
  const now = Date.now();
  // Find Highlightly matches that already kicked off (last 6 hours) and are not finished, skipping excluded leagues.
  const { data } = await db
    .from("matches")
    .select("league_id, kickoff_at")
    .eq("source", "highlightly")
    .not("league_id", "in", `(${MATCH_EXCLUDED.join(",")})`)
    .eq("is_finished", false)
    .lte("kickoff_at", new Date(now).toISOString())
    .gte("kickoff_at", new Date(now - WINDOW_MS).toISOString());
  // Unique "league|date" keys: we need only one API request for each of them.
  const keys = new Set((data ?? []).map((r) => `${r.league_id}|${r.kickoff_at.slice(0, 10)}`));
  if (!keys.size) return { skipped: "niciun meci Highlightly in desfasurare", saved: 0 }; // nothing to update -> no API call
  if (!force && (await recentlyUpdated(db, "highlightly"))) return { throttled: true, saved: 0 }; // too soon since last run

  let saved = 0;
  for (const key of keys) {
    const [code, day] = key.split("|");
    try {
      const matches = await fetchMatchesByDate(code, day); // all matches of that league on that day
      // Convert to database rows, dropping those that would un-finish an already finished match.
      const { rows, was } = await keepFinished(db, matches.map((m) => highlightlyRow(m, code)));
      if (rows.length) {
        const { error } = await db.from("matches").upsert(rows, { onConflict: "id" }); // insert or update
        if (error) throw new Error(error.message);
        await markFinished(db, rows, was); // timestamp the newly finished matches
        saved += rows.length;
      }
    } catch (e) {
      // One failing league must not stop the others.
      console.error("hl live", code, day, e);
    }
  }
  // Award points for finished matches.
  const { error: settleError } = await db.rpc("settle_predictions");
  if (settleError) throw new Error(settleError.message);
  return { requests: keys.size, saved };
}

// Public entry point: live sync + the standings refresh that follows finished matches.
// The standings part also runs when no match is live any more (for the follow-up call 10 minutes after the end).
export async function syncFootballLive(db: SupabaseClient, force = false): Promise<LiveResult> {
  const r = await footballLive(db, force);
  // A standings error is only logged, so it never breaks the match sync result.
  const standings = await refreshDueStandings(db, "football-data").catch((e) => {
    console.error("standings football", e);
    return [] as string[];
  });
  return { ...r, standings };
}

// Same as above, for the Highlightly source.
export async function syncHighlightlyLive(db: SupabaseClient, force = false): Promise<LiveResult> {
  const r = await highlightlyLive(db, force);
  const standings = await refreshDueStandings(db, "highlightly").catch((e) => {
    console.error("standings highlightly", e);
    return [] as string[];
  });
  return { ...r, standings };
}
