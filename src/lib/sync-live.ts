import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMatchesByDateRange, toRow as footballRow } from "./football";
import { fetchMatchesByDate, toRow as highlightlyRow } from "./highlightly";
import { MATCH_EXCLUDED } from "@/lib/football";
import { refreshDueStandings } from "./standings";

// Sincronizarea "live", folosita si de joburile cron, si de reimprospatarea la vizita (/api/refresh).
// Oricine o declanseaza, ea se opreste singura daca:
//  - nu exista niciun meci inceput si neterminat (ultimele 6 ore) -> 0 request-uri catre API
//  - s-a mai rulat acum mai putin de 4 minute pentru aceeasi sursa (evita dublarea cererilor)
const THROTTLE_MS = 4 * 60e3;
const WINDOW_MS = 6 * 3600e3;

export type LiveResult = { skipped?: string; throttled?: boolean; requests?: number; saved: number; standings?: string[] };

// Noteaza momentul in care un meci a fost vazut prima oara ca terminat (folosit pentru clasamentul de dupa meci)
// Doar meciurile care NU erau terminate inainte de aceasta sincronizare (evita un val de apeluri la prima rulare)
async function finishedIds(db: SupabaseClient, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const { data } = await db.from("matches").select("id").in("id", ids).eq("is_finished", true);
  return new Set((data ?? []).map((r) => r.id as number));
}

async function markFinished(db: SupabaseClient, rows: { id: number; is_finished: boolean }[], wasFinished: Set<number>) {
  const ids = rows.filter((r) => r.is_finished && !wasFinished.has(r.id)).map((r) => r.id);
  if (!ids.length) return;
  await db.from("matches").update({ finished_at: new Date().toISOString() }).in("id", ids).eq("is_finished", true).is("finished_at", null);
}

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

async function footballLive(db: SupabaseClient, force: boolean): Promise<LiveResult> {
  const now = Date.now();
  const { count } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .neq("source", "highlightly")
    .eq("is_finished", false)
    .lte("kickoff_at", new Date(now).toISOString())
    .gte("kickoff_at", new Date(now - WINDOW_MS).toISOString());
  if (!count) return { skipped: "niciun meci football-data in desfasurare", saved: 0 };
  if (!force && (await recentlyUpdated(db, "football-data"))) return { throttled: true, saved: 0 };

  // ieri + azi (+ maine, ca sa nu depindem de cum trateaza API-ul data de final), cu toate statusurile: prindem si meciul tocmai terminat, care nu mai apare in lista "in desfasurare"
  const day = (offset: number) => new Date(now + offset * 86400e3).toISOString().slice(0, 10);
  const matches = await fetchMatchesByDateRange(day(-1), day(1));
  const rows = [...new Map(matches.map(footballRow).map((r) => [r.id, r])).values()];
  if (rows.length) {
    const was = await finishedIds(db, rows.map((r) => r.id));
    const { error } = await db.from("matches").upsert(rows, { onConflict: "id" });
    if (error) throw new Error(error.message);
    await markFinished(db, rows, was);
  }
  const { error: settleError } = await db.rpc("settle_predictions");
  if (settleError) throw new Error(settleError.message);
  return { requests: 1, saved: rows.length };
}

async function highlightlyLive(db: SupabaseClient, force: boolean): Promise<LiveResult> {
  const now = Date.now();
  const { data } = await db
    .from("matches")
    .select("league_id, kickoff_at")
    .eq("source", "highlightly")
    .not("league_id", "in", `(${MATCH_EXCLUDED.join(",")})`)
    .eq("is_finished", false)
    .lte("kickoff_at", new Date(now).toISOString())
    .gte("kickoff_at", new Date(now - WINDOW_MS).toISOString());
  const keys = new Set((data ?? []).map((r) => `${r.league_id}|${r.kickoff_at.slice(0, 10)}`));
  if (!keys.size) return { skipped: "niciun meci Highlightly in desfasurare", saved: 0 };
  if (!force && (await recentlyUpdated(db, "highlightly"))) return { throttled: true, saved: 0 };

  let saved = 0;
  for (const key of keys) {
    const [code, day] = key.split("|");
    try {
      const matches = await fetchMatchesByDate(code, day);
      const rows = matches.map((m) => highlightlyRow(m, code));
      if (rows.length) {
        const was = await finishedIds(db, rows.map((r) => r.id));
        const { error } = await db.from("matches").upsert(rows, { onConflict: "id" });
        if (error) throw new Error(error.message);
        await markFinished(db, rows, was);
        saved += rows.length;
      }
    } catch (e) {
      console.error("hl live", code, day, e);
    }
  }
  const { error: settleError } = await db.rpc("settle_predictions");
  if (settleError) throw new Error(settleError.message);
  return { requests: keys.size, saved };
}

// Sincronizarea live + clasamentul de dupa meciurile terminate (acesta ruleaza si cand nu mai e niciun meci live,
// pentru apelul de la 10 minute dupa final)
export async function syncFootballLive(db: SupabaseClient, force = false): Promise<LiveResult> {
  const r = await footballLive(db, force);
  const standings = await refreshDueStandings(db, "football-data").catch((e) => {
    console.error("standings football", e);
    return [] as string[];
  });
  return { ...r, standings };
}

export async function syncHighlightlyLive(db: SupabaseClient, force = false): Promise<LiveResult> {
  const r = await highlightlyLive(db, force);
  const standings = await refreshDueStandings(db, "highlightly").catch((e) => {
    console.error("standings highlightly", e);
    return [] as string[];
  });
  return { ...r, standings };
}
