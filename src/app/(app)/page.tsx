import { MATCH_EXCLUDED } from "@/lib/football";
import { createClient } from "@/lib/supabase/server";
import MatchCard from "@/components/MatchCard";
import AutoRefresh from "@/components/AutoRefresh";
import TeamSearch from "@/components/TeamSearch";
import { dayKey, dayLabel, matchPhase, startOfDayRO } from "@/lib/format";
import type { Match, Prediction } from "@/lib/types";

export const dynamic = "force-dynamic"; // always render fresh data, never cache

// Error messages (Romanian) shown when the URL carries ?error=<key>.
const ERRORS: Record<string, string> = {
  locked: "Meciul a început deja, pronosticul e blocat.",
  invalid: "Scor invalid. Folosește numere între 0 și 20.",
};

// "Meciuri" page: today's and tomorrow's matches, each with the prediction form or the result.
export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const now = Date.now();

  // We show only the current day and the next day (Romania time): the limit is the start of the day after tomorrow
  const windowEnd = startOfDayRO(startOfDayRO(now) + 49 * 3600e3);

  // Load the matches of the window, skipping leagues that are "table only".
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .not("league_id", "in", `(${MATCH_EXCLUDED.join(",")})`)
    // Today's matches stay all day (including finished ones); unfinished ones (including "Se verifica") stay up to 12 hours after kickoff, so they do not disappear between Meciuri and Rezultate
    .or(`kickoff_at.gte.${new Date(startOfDayRO(now)).toISOString()},and(is_finished.eq.false,kickoff_at.gte.${new Date(now - 12 * 3600e3).toISOString()})`)
    .lt("kickoff_at", new Date(windowEnd).toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(150)
    .returns<Match[]>();

  // Load the logged-in user's predictions for those matches (if any).
  const ids = (matches ?? []).map((m) => m.id);
  const { data: preds } = ids.length
    ? await supabase
        .from("predictions")
        .select("match_id, home_goals, away_goals, points")
        .eq("user_id", user!.id)
        .in("match_id", ids)
        .returns<Prediction[]>()
    : { data: [] as Prediction[] };
  const byMatch = new Map((preds ?? []).map((p) => [p.match_id, p])); // match id -> prediction

  // Group the matches by day (Romania time).
  const days = new Map<string, Match[]>();
  for (const m of matches ?? []) {
    const k = dayKey(m.kickoff_at);
    days.set(k, [...(days.get(k) ?? []), m]);
  }

  // Is there a match in progress (or not yet confirmed) in the last 6 hours? Then the page asks for refreshes.
  const active = (matches ?? []).some((m) => {
    const phase = matchPhase(m, now);
    if (phase === "finished" && m.finished_at) return now - new Date(m.finished_at).getTime() < 20 * 60e3; // standings after the match
    return (phase === "live" || phase === "checking") && now - new Date(m.kickoff_at).getTime() < 6 * 3600e3;
  });

  // Team list (with league) for the search dropdown, sorted alphabetically.
  const teamMap = new Map<string, string>();
  for (const m of matches ?? []) {
    teamMap.set(m.home_team, m.league_name);
    teamMap.set(m.away_team, m.league_name);
  }
  const teams = [...teamMap.entries()].map(([name, league]) => ({ name, league })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <AutoRefresh active={active} />
      <TeamSearch teams={teams} scopeId="match-list" />
      {error && ERRORS[error] && <p className="notice" role="alert">{ERRORS[error]}</p>}
      {days.size === 0 && <p className="muted">Nu sunt meciuri pentru azi și mâine.</p>}
      <div id="match-list">
      {[...days.entries()].map(([k, list]) => (
        <section key={k} data-day>
          <h2 className="day">{dayLabel(list[0].kickoff_at)}</h2>
          {list.map((m) => (
            <div key={m.id} data-teams={`${m.home_team}|${m.away_team}`}>
              <MatchCard match={m} prediction={byMatch.get(m.id)} now={now} />
            </div>
          ))}
        </section>
      ))}
      </div>
    </>
  );
}
