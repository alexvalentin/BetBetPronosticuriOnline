import { MATCH_EXCLUDED } from "@/lib/football";
import { createClient } from "@/lib/supabase/server";
import { dateTimeShort, historyChip } from "@/lib/format";
import TeamSearch from "@/components/TeamSearch";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic"; // always render fresh data, never cache

type Pick = { user_id: string; home_goals: number; away_goals: number; points: number | null };
type MatchWithPicks = Match & { predictions: Pick[] }; // a match together with every user's prediction

// "Rezultate" page: the last finished matches with everybody's predictions and points.
export default async function HistoryPage() {
  const supabase = await createClient();
  // Load, in parallel: the last 60 finished matches (with their predictions) and the list of players.
  const [{ data: matches }, { data: profiles }] = await Promise.all([
    supabase
      .from("matches")
      .select("*, predictions(user_id, home_goals, away_goals, points)")
      .not("league_id", "in", `(${MATCH_EXCLUDED.join(",")})`)
      .eq("is_finished", true)
      .order("kickoff_at", { ascending: false })
      .limit(60)
      .returns<MatchWithPicks[]>(),
    supabase.from("profiles").select("id, display_name").order("display_name"),
  ]);

  // Team list (with league) for the search dropdown, sorted alphabetically.
  const teamMap = new Map<string, string>();
  for (const m of matches ?? []) {
    teamMap.set(m.home_team, m.league_name);
    teamMap.set(m.away_team, m.league_name);
  }
  const teams = [...teamMap.entries()].map(([name, league]) => ({ name, league })).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <h1 className="title">Rezultate</h1>
      <TeamSearch teams={teams} scopeId="history-list" />
      <div id="history-list">
      {(matches ?? []).length === 0 && <p className="muted">Încă nu s-a terminat niciun meci.</p>}
      {(matches ?? []).map((m) => (
        <article className="match" key={m.id} data-teams={`${m.home_team}|${m.away_team}`}>
          {/* League pill */}
          <div className="meta">
            <span className="league" data-league={m.league_id}>{m.league_name}</span>
          </div>
          {/* Teams and the final score, with the date/time above the score */}
          <div className="result">
            <div className="team">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.home_logo && <img src={m.home_logo} alt="" width={33} height={31} loading="lazy" />}
              <span>{m.home_team}</span>
            </div>
            <div className="score">
              <span className="when">{dateTimeShort(m.kickoff_at)}</span>
              <b>{m.home_goals}:{m.away_goals}</b>
            </div>
            <div className="team away">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.away_logo && <img src={m.away_logo} alt="" width={31} height={29} loading="lazy" />}
              <span>{m.away_team}</span>
            </div>
          </div>
          {/* List of predictions, shown only if at least one player predicted this match */}
          {(profiles ?? []).some((p) => m.predictions.some((x) => x.user_id === p.id)) && (
            <>
              <div className="fade-line" aria-hidden="true" />
              <ul className="picks">
                {(profiles ?? []).map((p) => {
                  const pick = m.predictions.find((x) => x.user_id === p.id);
                  if (!pick) return null; // no prediction: we do not show the user at all
                  const chip = historyChip(pick.points); // colored points badge
                  return (
                    <li key={p.id}>
                      <span className="pick-user">User: {p.display_name}</span>
                      <span className="pick-result">
                        <span className="pick-score">Pronostic: {pick.home_goals}:{pick.away_goals}</span>
                        {chip && <span className={`hchip ${chip.tone}`}>{chip.text}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </article>
      ))}
      </div>
    </>
  );
}
