import type { SupabaseClient } from "@supabase/supabase-js";
import { LEAGUES, fetchStandings } from "./football";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 1 request per competitie urmarita. 8 competitii, deci 8 request-uri pe rulare, mult sub limita de 10/min.
export async function refreshAllStandings(db: SupabaseClient) {
  const refreshed: string[] = [];
  for (const code of Object.keys(LEAGUES)) {
    try {
      const res = await fetchStandings(code);
      // Pastram randul TOTAL al fiecarei grupe (ignoram HOME/AWAY, care dubleaza datele).
      const groups = res.standings.filter((g) => g.type === "TOTAL");
      if (groups.length === 0) continue; // competitie fara clasament acum (eliminatorii sau turneu inactiv)

      const seasonYear = new Date().getUTCMonth() >= 6 ? new Date().getUTCFullYear() : new Date().getUTCFullYear() - 1;
      const { error } = await db.from("standings").upsert(
        {
          league_id: code,
          season: seasonYear,
          league_name: LEAGUES[code],
          data: groups.map((g) => g.table),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "league_id,season" }
      );
      if (error) throw new Error(error.message);
      refreshed.push(code);
    } catch (e) {
      console.error("standings", code, e);
    }
    await sleep(2500); // ramanem sub limita de 10 request-uri/minut, cu marja mai mare
  }
  return refreshed;
}
