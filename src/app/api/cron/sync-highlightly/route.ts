import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAGUES, fetchMatchesByDate, fetchStandings, toRow } from "@/lib/highlightly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// mode=upcoming  -> ieri + azi + urmatoarele 2 zile (4 zile), pentru fiecare din cele 5 competitii: 20 request-uri
// mode=live      -> doar competitiile cu un meci inceput si neterminat in baza noastra: 0-5 request-uri
// mode=standings -> o data pe zi, cate un request per competitie: 5 request-uri
// Total pe zi, in cel mai incarcat caz: ~25, mult sub limita de 100 a acestui API.
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const mode = new URL(req.url).searchParams.get("mode") ?? "live";
  const db = createAdminClient();
  const codes = Object.keys(LEAGUES);

  if (mode === "standings") {
    const refreshed: string[] = [];
    for (const code of codes) {
      try {
        const data = await fetchStandings(code);
        if (data.length === 0) continue; // nu suprascriem un tabel existent cu unul gol (ex: eliminatorii, fara tabel clasic)
        const { error } = await db.from("standings").upsert(
          { league_id: code, season: 2026, league_name: LEAGUES[code], data, updated_at: new Date().toISOString() },
          { onConflict: "league_id,season" }
        );
        if (error) throw new Error(error.message);
        refreshed.push(code);
      } catch (e) {
        console.error("hl standings", code, e);
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    return NextResponse.json({ mode, refreshed });
  }

  let days: string[];
  if (mode === "upcoming") {
    // Ieri (ca sa prindem scorul final al meciurilor terminate de curand) + azi + urmatoarele 2 zile
    days = [-1, 0, 1, 2].map((i) => new Date(Date.now() + i * 86400e3).toISOString().slice(0, 10));
  } else {
    // live: doar zilele in care avem deja un meci Highlightly inceput si neterminat
    const now = Date.now();
    const { data } = await db
      .from("matches")
      .select("kickoff_at")
      .eq("source", "highlightly")
      .eq("is_finished", false)
      .lte("kickoff_at", new Date(now).toISOString())
      .gte("kickoff_at", new Date(now - 6 * 3600e3).toISOString());
    days = [...new Set((data ?? []).map((r) => r.kickoff_at.slice(0, 10)))];
    if (!days.length) return NextResponse.json({ skipped: "niciun meci Highlightly in desfasurare" });
  }

  let saved = 0;
  for (const code of codes) {
    for (const day of days) {
      try {
        const matches = await fetchMatchesByDate(code, day);
        const rows = matches.map((m) => toRow(m, code));
        if (rows.length) {
          const { error } = await db.from("matches").upsert(rows, { onConflict: "id" });
          if (error) throw new Error(error.message);
          saved += rows.length;
        }
      } catch (e) {
        console.error("hl matches", code, day, e);
      }
    }
  }

  const { error: settleError } = await db.rpc("settle_predictions");
  if (settleError) return NextResponse.json({ error: settleError.message }, { status: 500 });

  return NextResponse.json({ mode, days, saved });
}
