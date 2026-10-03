import { createClient } from "@/lib/supabase/server";
import MatchCard from "@/components/MatchCard";
import { dayKey, dayLabel } from "@/lib/format";
import type { Match, Prediction } from "@/lib/types";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  locked: "Meciul a început deja, pronosticul e blocat.",
  invalid: "Scor invalid. Folosește numere între 0 și 20.",
};

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = Date.now();

  // Afisam doar urmatoarele 3 zile, incepand de azi (indiferent de sursa: football-data.org sau Highlightly)
  const windowEnd = new Date(now);
  windowEnd.setHours(23, 59, 59, 999);
  windowEnd.setDate(windowEnd.getDate() + 2);

  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .gte("kickoff_at", new Date(now - 4 * 3600e3).toISOString())
    .lte("kickoff_at", windowEnd.toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(150)
    .returns<Match[]>();

  const ids = (matches ?? []).map((m) => m.id);
  const { data: preds } = ids.length
    ? await supabase
        .from("predictions")
        .select("match_id, home_goals, away_goals, points")
        .eq("user_id", user!.id)
        .in("match_id", ids)
        .returns<Prediction[]>()
    : { data: [] as Prediction[] };
  const byMatch = new Map((preds ?? []).map((p) => [p.match_id, p]));

  const days = new Map<string, Match[]>();
  for (const m of matches ?? []) {
    const k = dayKey(m.kickoff_at);
    days.set(k, [...(days.get(k) ?? []), m]);
  }

  return (
    <>
      {error && ERRORS[error] && <p className="notice" role="alert">{ERRORS[error]}</p>}
      {days.size === 0 && <p className="muted">Nu sunt meciuri în programul următoarelor zile.</p>}
      {[...days.entries()].map(([k, list]) => (
        <section key={k}>
          <h2 className="day">{dayLabel(list[0].kickoff_at)}</h2>
          {list.map((m) => (
            <MatchCard key={m.id} match={m} prediction={byMatch.get(m.id)} now={now} />
          ))}
        </section>
      ))}
    </>
  );
}
