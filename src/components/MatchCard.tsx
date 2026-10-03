import { savePrediction } from "@/app/actions";
import type { Match, Prediction } from "@/lib/types";
import { dateLabel, pointsChip, statusLabel, timeLabel } from "@/lib/format";
import SaveButton from "@/components/SaveButton";

function Team({ name, logo, away }: { name: string; logo: string | null; away?: boolean }) {
  return (
    <div className={`team${away ? " away" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo && <img src={logo} alt="" width={38} height={36} loading="lazy" />}
      <span>{name}</span>
    </div>
  );
}

export default function MatchCard({
  match,
  prediction,
  now,
}: {
  match: Match;
  prediction?: Prediction;
  now: number;
}) {
  const open = !match.is_finished && new Date(match.kickoff_at).getTime() > now;
  const chip = pointsChip(prediction?.points ?? null);

  return (
    <article className="match">
      <div className="meta">
        <span className="league">{match.league_name}</span>
        {match.round && <span>{match.round}</span>}
        <span>{dateLabel(match.kickoff_at)} · {timeLabel(match.kickoff_at)}</span>
      </div>

      {open ? (
        <form action={savePrediction} className="board">
          <input type="hidden" name="match_id" value={match.id} />
          <Team name={match.home_team} logo={match.home_logo} />
          <div className="digits">
            <input
              name="home"
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              required
              placeholder=" "
              defaultValue={prediction?.home_goals}
              aria-label={`Goluri ${match.home_team}`}
            />
            <span aria-hidden="true">:</span>
            <input
              name="away"
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              required
              placeholder=" "
              defaultValue={prediction?.away_goals}
              aria-label={`Goluri ${match.away_team}`}
            />
          </div>
          <Team name={match.away_team} logo={match.away_logo} away />
          <div className="board-foot">
            {prediction && <span className="chip pending">Pronostic salvat</span>}
            <SaveButton editing={!!prediction} />
          </div>
        </form>
      ) : (
        <div className="board">
          <Team name={match.home_team} logo={match.home_logo} />
          <div className="digits static" aria-label="Pronosticul tău">
            <b>{prediction ? prediction.home_goals : "–"}</b>
            <span aria-hidden="true">:</span>
            <b>{prediction ? prediction.away_goals : "–"}</b>
          </div>
          <Team name={match.away_team} logo={match.away_logo} away />
          <div className="board-foot">
            <span className="muted">
              {statusLabel(match)}
              {match.is_finished && ` – rezultat după 90 min ${match.home_goals}:${match.away_goals}`}
              {!prediction && " – fără pronostic"}
            </span>
            {chip && <span className={`chip ${chip.tone}`}>{chip.text}</span>}
          </div>
        </div>
      )}
    </article>
  );
}
