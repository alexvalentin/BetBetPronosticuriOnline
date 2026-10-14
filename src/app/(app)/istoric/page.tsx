import { MATCH_EXCLUDED } from "@/lib/football";
import { createClient } from "@/lib/supabase/server";
import { dateTimeShort, historyChip } from "@/lib/format";
import type { Match } from "@/lib/types";

export const dynamic = "force-dynamic";

type Pick = { user_id: string; home_goals: number; away_goals: number; points: number | null };
type MatchWithPicks = Match & { predictions: Pick[] };

export default async function HistoryPage() {
  const supabase = await createClient();
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

  return (
    <>
      <h1 className="title">Istoric</h1>
      {(matches ?? []).length === 0 && <p className="muted">Încă nu s-a terminat niciun meci.</p>}
      {(matches ?? []).map((m) => (
        <article className="match" key={m.id}>
          <div className="meta">
            <span className="league">{m.league_name}</span>
          </div>
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
          {(profiles ?? []).some((p) => m.predictions.some((x) => x.user_id === p.id)) && (
            <>
              <div className="fade-line" aria-hidden="true" />
              <ul className="picks">
                {(profiles ?? []).map((p) => {
                  const pick = m.predictions.find((x) => x.user_id === p.id);
                  if (!pick) return null; // fara pronostic: nu afisam userul deloc
                  const chip = historyChip(pick.points);
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
    </>
  );
}
