import type { SupabaseClient } from "@supabase/supabase-js";
import { LEAGUES, fetchStandings, MATCH_EXCLUDED } from "./football";
import { LEAGUES as HL_LEAGUES, CUP_IDS, fetchStandings as fetchHlStandings } from "./highlightly";

// Simple promise-based pause.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1 request per tracked competition. 8 competitions = 8 requests per run, well under the 10/min limit.
// Standings of a single football-data.org competition (1 request). Returns false if there is no table right now.
export async function refreshFootballStandings(db: SupabaseClient, code: string): Promise<boolean> {
  const res = await fetchStandings(code);
  const groups = res.standings.filter((g) => g.type === "TOTAL"); // keep the overall table (not home/away tables)
  if (groups.length === 0) return false;
  // Seasons start in summer: from July on we are in the season that started this year, before that in last year's.
  const seasonYear = new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
  const { error } = await db.from("standings").upsert(
    { league_id: code, season: seasonYear, league_name: LEAGUES[code], data: groups.map((g) => g.table), updated_at: new Date().toISOString() },
    { onConflict: "league_id,season" }
  );
  if (error) throw new Error(error.message);
  return true;
}

// Standings of a single Highlightly competition (1 request). Never overwrites an existing table with an empty one.
export async function refreshHighlightlyStandings(db: SupabaseClient, code: string): Promise<boolean> {
  const data = await fetchHlStandings(code);
  if (data.length === 0) return false;
  const { error } = await db.from("standings").upsert(
    { league_id: code, season: 2026, league_name: HL_LEAGUES[code], data, updated_at: new Date().toISOString() },
    { onConflict: "league_id,season" }
  );
  if (error) throw new Error(error.message);
  return true;
}

const MIN = 60e3; // one minute in milliseconds
const GROUP_GAP = 30 * MIN; // matches starting at most 30 min apart form one "group"
const FOLLOW_UP = 10 * MIN; // second call, 10 minutes after the end
const MAX_AGE = 40 * MIN; // 40 min after the end we stop making calls (the 01:10 daily call remains)

/**
 * Standings after finished matches, once per competition and "group" of matches:
 *  - we wait until all matches of the group are finished (those starting at the same time, +-30 min)
 *  - football-data.org: one call right after the end and another one 10 minutes later
 *  - Highlightly (limit 100/day): a single call, 10 minutes after the end
 * It makes no API request when there is nothing to do (only a query to our own database).
 */
export async function refreshDueStandings(db: SupabaseClient, source: "football-data" | "highlightly"): Promise<string[]> {
  const now = Date.now();
  // Matches of this source that finished within the last MAX_AGE (excluded leagues are skipped).
  const q = db
    .from("matches")
    .select("league_id, kickoff_at, finished_at")
    .not("league_id", "in", `(${MATCH_EXCLUDED.join(",")})`)
    .gte("finished_at", new Date(now - MAX_AGE).toISOString());
  const { data: finished } = await (source === "highlightly" ? q.eq("source", "highlightly") : q.neq("source", "highlightly"));
  if (!finished?.length) return [];

  // Per league: when the last match finished and the earliest/latest kickoff of those matches.
  const byLeague = new Map<string, { lastFinish: number; minKick: number; maxKick: number }>();
  for (const m of finished) {
    const f = new Date(m.finished_at).getTime();
    const k = new Date(m.kickoff_at).getTime();
    const g = byLeague.get(m.league_id);
    byLeague.set(
      m.league_id,
      g ? { lastFinish: Math.max(g.lastFinish, f), minKick: Math.min(g.minKick, k), maxKick: Math.max(g.maxKick, k) } : { lastFinish: f, minKick: k, maxKick: k }
    );
  }

  const done: string[] = []; // leagues whose standings were refreshed in this run
  for (const [league, g] of byLeague) {
    if (source === "highlightly" && CUP_IDS.has(league)) continue; // cups have no standings table: no request
    // Are there matches of the same group still in progress? Then we wait.
    const { count: pending } = await db
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league)
      .eq("is_finished", false)
      .not("status", "in", "(POSTPONED,Postponed,CANCELLED,Cancelled)")
      .lte("kickoff_at", new Date(now).toISOString())
      .gte("kickoff_at", new Date(Math.max(g.minKick - GROUP_GAP, now - 4 * 3600e3)).toISOString())
      .lte("kickoff_at", new Date(g.maxKick + GROUP_GAP).toISOString());
    if (pending) continue;

    // When were the standings of this league last refreshed?
    const { data: st } = await db.from("standings").select("updated_at").eq("league_id", league).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const refreshedAt = st ? new Date(st.updated_at).getTime() : 0;
    // "immediate" = right after the last match ended (football-data only); "followUp" = 10 min after the end.
    const immediate = source === "football-data" && now >= g.lastFinish && refreshedAt < g.lastFinish;
    const followUp = now >= g.lastFinish + FOLLOW_UP && refreshedAt < g.lastFinish + FOLLOW_UP;
    if (!immediate && !followUp) continue;

    try {
      const ok = source === "highlightly" ? await refreshHighlightlyStandings(db, league) : await refreshFootballStandings(db, league);
      if (ok) done.push(league);
    } catch (e) {
      console.error("standings dupa meci", league, e);
    }
  }
  return done;
}

// Refreshes the standings of ALL football-data competitions (used by the nightly job).
export async function refreshAllStandings(db: SupabaseClient) {
  const refreshed: string[] = [];
  for (const code of Object.keys(LEAGUES)) {
    try {
      if (await refreshFootballStandings(db, code)) refreshed.push(code);
    } catch (e) {
      console.error("standings", code, e);
    }
    await sleep(3500); // we stay under the 10 requests/minute limit, with a wider margin
  }
  return refreshed;
}
