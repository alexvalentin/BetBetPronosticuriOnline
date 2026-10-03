import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMatchesByDateRange, fetchLiveMatches, toRow } from "@/lib/football";
import { refreshAllStandings } from "@/lib/standings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// mode=upcoming  -> o data pe zi: programul din urmatoarele zile (1 request)
// mode=live      -> la fiecare 15 min: doar meciurile aflate ACUM in desfasurare (1 request)
// mode=standings -> o data pe zi: clasamentul fiecarei competitii urmarite (8 request-uri)
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const mode = new URL(req.url).searchParams.get("mode") ?? "live";
  const db = createAdminClient();

  if (mode === "standings") {
    const refreshed = await refreshAllStandings(db);
    return NextResponse.json({ mode, refreshed });
  }

  let matches: Awaited<ReturnType<typeof fetchLiveMatches>> = [];
  if (mode === "upcoming") {
    // Planul gratuit permite maxim 10 zile per apel, deci acoperim 27 de zile din 3 apeluri succesive
    // (evita o fereastra goala in pauzele internationale, cand urmatorul meci de club e mai departe).
    for (let chunk = 0; chunk < 3; chunk++) {
      const from = new Date(Date.now() + (chunk * 9 - 1) * 86400e3).toISOString().slice(0, 10);
      const to = new Date(Date.now() + (chunk * 9 + 8) * 86400e3).toISOString().slice(0, 10);
      matches.push(...(await fetchMatchesByDateRange(from, to)));
    }
  } else {
    matches = await fetchLiveMatches();
  }

  //const rows = matches.map(toRow);
  const rows = [...new Map(matches.map(toRow).map((r) => [r.id, r])).values()];
	
  if (rows.length) {
    const { error } = await db.from("matches").upsert(rows, { onConflict: "id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { error: settleError } = await db.rpc("settle_predictions");
  if (settleError) return NextResponse.json({ error: settleError.message }, { status: 500 });

  return NextResponse.json({ mode, fetched: matches.length, saved: rows.length });
}
