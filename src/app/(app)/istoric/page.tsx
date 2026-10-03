import { createClient } from "@/lib/supabase/server";
import { dayLabel, pointsChip, predictionReason } from "@/lib/format";
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
            <span>{dayLabel(m.kickoff_at)}</span>
          </div>
          <h3 className="result">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.home_logo && <img src={m.home_logo} alt="" width={38} height={36} loading="lazy" />}
            {m.home_team} <b>{m.home_goals}:{m.away_goals}</b> {m.away_team}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {m.away_logo && <img src={m.away_logo} alt="" width={38} height={36} loading="lazy" />}
          </h3>
          <ul className="picks">
            {(profiles ?? []).map((p) => {
              const pick = m.predictions.find((x) => x.user_id === p.id);
              const chip = pointsChip(pick?.points ?? null);
              const reason = pick ? predictionReason(pick, m) : null;
              return (
                <li key={p.id}>
                  <span>User: {p.display_name}</span>
                  <span className="pick-result">
                    <span>
                      {pick ? <>Pronostic: {pick.home_goals}:{pick.away_goals}</> : "fără pronostic"}{" "}
                      {chip && <span className={`chip ${chip.tone}`}>{chip.text}</span>}
                    </span>
                    {reason && <span className="muted small reason">{reason}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </article>
      ))}
    </>
  );
}
