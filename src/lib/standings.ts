import type { SupabaseClient } from "@supabase/supabase-js";
import { LEAGUES, fetchStandings, MATCH_EXCLUDED } from "./football";
import { LEAGUES as HL_LEAGUES, fetchStandings as fetchHlStandings } from "./highlightly";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1 request per competitie urmarita. 8 competitii, deci 8 request-uri pe rulare, mult sub limita de 10/min.
// Clasamentul unei singure competitii football-data.org (1 request). Returneaza false daca nu exista tabel acum.
export async function refreshFootballStandings(db: SupabaseClient, code: string): Promise<boolean> {
  const res = await fetchStandings(code);
  const groups = res.standings.filter((g) => g.type === "TOTAL");
  if (groups.length === 0) return false;
  const seasonYear = new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
  const { error } = await db.from("standings").upsert(
    { league_id: code, season: seasonYear, league_name: LEAGUES[code], data: groups.map((g) => g.table), updated_at: new Date().toISOString() },
    { onConflict: "league_id,season" }
  );
  if (error) throw new Error(error.message);
  return true;
}

// Clasamentul unei singure competitii Highlightly (1 request). Nu suprascrie un tabel existent cu unul gol.
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

const MIN = 60e3;
const GROUP_GAP = 30 * MIN; // meciurile care incep la cel mult 30 min distanta formeaza un "grup"
const FOLLOW_UP = 10 * MIN; // al doilea apel, la 10 minute dupa final
const MAX_AGE = 40 * MIN; // dupa 40 min de la final nu mai facem apeluri (ramane cel de la 01:10)

/**
 * Clasament dupa meciurile terminate, o singura data pe competitie si "grup" de meciuri:
 *  - se asteapta sa se termine toate meciurile grupului (cele care incep la aceeasi ora, +-30 min)
 *  - football-data.org: un apel imediat dupa final si inca unul la 10 minute dupa
 *  - Highlightly (limita 100/zi): un singur apel, la 10 minute dupa final
 * Nu face nicio cerere catre API daca nu e nimic de facut (doar o interogare in baza noastra).
 */
export async function refreshDueStandings(db: SupabaseClient, source: "football-data" | "highlightly"): Promise<string[]> {
  const now = Date.now();
  const q = db
    .from("matches")
    .select("league_id, kickoff_at, finished_at")
    .not("league_id", "in", `(${MATCH_EXCLUDED.join(",")})`)
    .gte("finished_at", new Date(now - MAX_AGE).toISOString());
  const { data: finished } = await (source === "highlightly" ? q.eq("source", "highlightly") : q.neq("source", "highlightly"));
  if (!finished?.length) return [];

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

  const done: string[] = [];
  for (const [league, g] of byLeague) {
    // mai sunt meciuri din acelasi grup in desfasurare? atunci asteptam
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

    const { data: st } = await db.from("standings").select("updated_at").eq("league_id", league).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const refreshedAt = st ? new Date(st.updated_at).getTime() : 0;
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

export async function refreshAllStandings(db: SupabaseClient) {
  const refreshed: string[] = [];
  for (const code of Object.keys(LEAGUES)) {
    try {
      if (await refreshFootballStandings(db, code)) refreshed.push(code);
    } catch (e) {
      console.error("standings", code, e);
    }
    await sleep(3500); // ramanem sub limita de 10 request-uri/minut, cu marja mai mare
  }
  return refreshed;
}
