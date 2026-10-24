import { savePrediction } from "@/app/actions";
import type { Match, Prediction } from "@/lib/types";
import { dateLabel, liveScore, roundLabel, matchPhase, pointsChip, statusLabel, timeLabel } from "@/lib/format";
import SaveButton from "@/components/SaveButton";

// One team: logo (if any) + name. `away` flips the layout for the away team.
function Team({ name, logo, away }: { name: string; logo: string | null; away?: boolean }) {
  return (
    <div className={`team${away ? " away" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {logo && <img src={logo} alt="" width={38} height={36} loading="lazy" />}
      <span>{name}</span>
    </div>
  );
}

// Card of one match. Before kickoff it shows the prediction form;
// after kickoff it shows the user's locked prediction, the live/final score and the points earned.
export default function MatchCard({
  match,
  prediction,
  now,
}: {
  match: Match;
  prediction?: Prediction;
  now: number;
}) {
  const kickoff = new Date(match.kickoff_at).getTime();
  const phase = matchPhase(match, now); // upcoming | live | checking | finished | off
  const round = roundLabel(match); // e.g. "Match 13"
  const open = !match.is_finished && phase !== "off" && kickoff > now; // predictions are possible only before kickoff
  const chip = pointsChip(prediction?.points ?? null); // points badge, once settled
  const score = phase === "live" || phase === "checking" ? liveScore(match) : null; // current score from the API data
  // The real score shown under the prediction: final (after 90 min), live, or the last known score
  const real =
    match.is_finished && match.home_goals !== null && match.away_goals !== null
      ? { home: match.home_goals, away: match.away_goals, label: "Rezultat final", live: false, final: true }
      : score
        ? { ...score, label: phase === "live" ? "Scor live" : "Ultimul scor", live: phase === "live", final: false }
        : null;

  return (
    <article className="match">
      {/* Top row: league pill, status badge (LIVE / TERMINAT / ...) and round badge */}
      <div className={`meta${phase !== "upcoming" ? " has-status" : ""}`}>
        <span className="league" data-league={match.league_id}>{match.league_name}</span>
        {/* forces the status badges onto a second row when there is a status */}
        {phase !== "upcoming" && <span className="meta-break" aria-hidden="true" />}
        {phase === "live" && (
          <span className="live-badge">
            <span className="live-dot" aria-hidden="true" />
            LIVE
          </span>
        )}
        {phase === "finished" && (
          <span className="finished-badge">
            <span className="finished-dot" aria-hidden="true" />
            TERMINAT
          </span>
        )}
        {phase === "checking" && <span className="check-badge">Se verifică</span>}
        {phase === "off" && (
          <span className="postponed-badge">
            {match.status === "POSTPONED" || match.status === "Postponed" ? "Amânat" : "Anulat"}
          </span>
        )}
        {round && <span className="round-badge">{round}</span>}
      </div>

      {open ? (
        // Before kickoff: editable prediction form (home team | score inputs | away team | save button)
        <form action={savePrediction} className="board">
          <input type="hidden" name="match_id" value={match.id} />
          <Team name={match.home_team} logo={match.home_logo} />
          <div className="predwrap">
            <small className="matchwhen">{dateLabel(match.kickoff_at)} · {timeLabel(match.kickoff_at)}</small>
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
          </div>
          <Team name={match.away_team} logo={match.away_logo} away />
          <div className="board-foot">
            {prediction && <span className="chip pending">Pronostic salvat</span>}
            <SaveButton editing={!!prediction} />
          </div>
        </form>
      ) : (
        // After kickoff: read-only board with the user's prediction
        <div className="board">
          <Team name={match.home_team} logo={match.home_logo} />
          <div className="predwrap two">
            <small className="matchwhen">{dateLabel(match.kickoff_at)} · {timeLabel(match.kickoff_at)}</small>
            <small className="predlabel">Pronosticul tău</small>
            <div className="digits static" aria-label="Pronosticul tău">
              <b>{prediction ? prediction.home_goals : "–"}</b>
              <span aria-hidden="true">:</span>
              <b>{prediction ? prediction.away_goals : "–"}</b>
            </div>
          </div>
          <Team name={match.away_team} logo={match.away_logo} away />
          {/* Footer: real score badge (live / final / last known) or the status text, plus the points badge */}
          <div className="board-foot">
            {real ? (
              <span className="footscore">
                {real.live ? (
                  <span className="live-badge" role="status">
                    <span className="live-dot" aria-hidden="true" />
                    {real.label.toUpperCase()} {real.home}:{real.away}
                  </span>
                ) : real.final ? (
                  <span className="finished-badge" role="status" title="Scorul după 90 de minute">
                    <span className="finished-dot" aria-hidden="true" />
                    {real.label.toUpperCase()} {real.home}:{real.away}
                  </span>
                ) : (
                  <span className="check-badge" role="status">
                    {real.label.toUpperCase()} {real.home}:{real.away}
                  </span>
                )}
                {!prediction && <span className="muted"> – fără pronostic</span>}
              </span>
            ) : (
              <span className="muted">
                {statusLabel(match, now)}
                {!prediction && " – fără pronostic"}
              </span>
            )}
            {chip && <span className={`chip ${chip.tone}`}>{chip.text}</span>}
          </div>
        </div>
      )}
    </article>
  );
}
