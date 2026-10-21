import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAGUES, fetchMatchesByDate, fetchStandings, toRow } from "@/lib/highlightly";
import { syncHighlightlyLive } from "@/lib/sync-live";
import { MATCH_EXCLUDED } from "@/lib/football";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// mode=upcoming  -> azi + maine (ora Romaniei), pentru fiecare competitie cu meciuri (fara Liga 2): 8 request-uri
// mode=live      -> doar perechile competitie+zi cu un meci inceput si neterminat in baza noastra: 0-cateva request-uri
// mode=standings -> o data pe zi, cate un request per competitie: 5 request-uri
// Total pe zi, in cel mai incarcat caz: ~10 + live + 5, mult sub limita de 100 a acestui API.
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

  if (mode === "live") {
    const force = new URL(req.url).searchParams.get("force") === "1";
    return NextResponse.json({ mode, ...(await syncHighlightlyLive(db, force)) });
  }

  // upcoming: doar azi si maine, dupa data din Romania (site-ul afiseaza doar aceste doua zile).
  // Scorul final al meciurilor de ieri vine din modul live; nu mai interogam ziua de ieri aici.
  const roDay = (offsetDays: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date(Date.now() + offsetDays * 86400e3));
  const days = [0, 1].map(roDay);
  const pairs = codes.filter((c) => !MATCH_EXCLUDED.includes(c)).flatMap((code) => days.map((day) => ({ code, day })));

  let saved = 0;
  for (const { code, day } of pairs) {
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

  const { error: settleError } = await db.rpc("settle_predictions");
  if (settleError) return NextResponse.json({ error: settleError.message }, { status: 500 });

  return NextResponse.json({ mode, requests: pairs.length, saved });
}
