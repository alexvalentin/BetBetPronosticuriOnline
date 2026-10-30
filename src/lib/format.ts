import type { Match } from "./types";

const TZ = "Europe/Bucharest"; // all dates and times are shown in Romania's time zone

// Calendar day of a timestamp in Romania's time zone, as "YYYY-MM-DD" (used to group matches by day).
export const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

// Long day heading in Romanian, e.g. "Sâmbătă, 24 octombrie" (first letter capitalized).
export function dayLabel(iso: string) {
  const s = new Date(iso).toLocaleDateString("ro-RO", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Full date, e.g. "24 octombrie 2026".
export const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest", day: "numeric", month: "long", year: "numeric" });

// Time of day, e.g. "19:45".
export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("ro-RO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

// 14.10.2026 19:45 (Romania time)
export const dateTimeShort = (iso: string) =>
  new Date(iso)
    .toLocaleString("ro-RO", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .replace(",", "");

// Status values (from both APIs) that mean "the match is being played right now".
const LIVE = new Set([
  "IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT", "SUSPENDED", // football-data.org
  "In Play", "First half", "Second half", "Half Time", "Extra Time", "Penalties", // Highlightly
]);

// Phase of a match, for the card on the Meciuri page:
//  upcoming = not started | live = in progress | checking = normal time has passed and the source has not confirmed the end yet
//  finished = over (confirmed by the source) | off = postponed/cancelled
// "Finished" comes ONLY from the source (is_finished); the estimated time (90 min + 15 min break + extra time ~ 2h15) only stops LIVE.
const OFF = ["POSTPONED", "Postponed", "CANCELLED", "Cancelled"];
const LIVE_AFTER_MS = 135 * 60e3; // 2h15 after kickoff
const LIVE_MAX_MS = 4 * 3600e3; // even if the source says "in progress", after 4h we no longer show LIVE

// Decides the phase of a match at the given moment `now` (in ms).
export function matchPhase(m: Match, now: number): "upcoming" | "live" | "checking" | "finished" | "off" {
  if (m.is_finished) return "finished";
  if (OFF.includes(m.status)) return "off";
  const since = now - new Date(m.kickoff_at).getTime(); // time elapsed since kickoff
  if (since < 0) return "upcoming";
  if (since < LIVE_AFTER_MS || (LIVE.has(m.status) && since < LIVE_MAX_MS)) return "live";
  return "checking";
}

// Romanian text describing the match phase.
export function statusLabel(m: Match, now: number = Date.now()) {
  switch (matchPhase(m, now)) {
    case "finished": return "Meci terminat";
    case "live": return "În desfășurare";
    case "checking": return "Scor indisponibil momentan";
    case "off": return m.status === "POSTPONED" || m.status === "Postponed" ? "Amânat" : "Anulat";
    default: return "Programat";
  }
}

// Points badge (text + color tone) for a prediction, or null if the match is not settled yet.
export function pointsChip(points: number | null) {
  if (points === null) return null;
  if (points === 3) return { text: "Scor exact +3", tone: "exact" };
  if (points === 1) return { text: "Rezultat corect +1", tone: "ok" };
  return { text: "Greșit 0", tone: "miss" };
}

// Points label for Rezultate: green = exact score, yellow = correct outcome, red = wrong
export function historyChip(points: number | null) {
  if (points === null) return null;
  if (points === 3) return { text: "Scor exact +3", tone: "h-exact" };
  if (points === 1) return { text: "Rezultat corect +1", tone: "h-ok" };
  return { text: "Greșit +0", tone: "h-miss" };
}

// Briefly explains why a prediction got its points, by comparing the prediction with the real result
export function predictionReason(
  pick: { home_goals: number; away_goals: number; points: number | null },
  match: { home_goals: number | null; away_goals: number | null }
) {
  if (pick.points === null || match.home_goals === null || match.away_goals === null) return null;
  if (pick.points === 3) return "Scor exact!";
  if (pick.points === 1) {
    // Which outcome did the user predict: draw, home win or away win?
    const predicted = pick.home_goals === pick.away_goals ? "draw" : pick.home_goals > pick.away_goals ? "home" : "away";
    return predicted === "draw" ? "Egal ghicit, dar scorul nu." : "Echipa castigatoare ghicita, dar nu si scorul.";
  }
  return "Nici rezultatul, nici scorul nu au fost corecte.";
}

// Start of the current day in Romania's time zone (as a UTC instant, in ms)
export function startOfDayRO(now: number) {
  const key = dayKey(new Date(now).toISOString());
  const utcMidnight = Date.parse(`${key}T00:00:00Z`);
  // Romania is UTC+3 in summer and UTC+2 in winter: try both offsets and keep the one that lands exactly on the day boundary.
  for (const off of [3, 2]) {
    const t = utcMidnight - off * 3600e3;
    if (dayKey(new Date(t).toISOString()) === key && dayKey(new Date(t - 1).toISOString()) !== key) return t;
  }
  return utcMidnight - 3 * 3600e3;
}

/** Current score from the API response (only while the match is not marked as finished). */
export function liveScore(m: Match): { home: number; away: number } | null {
  const r = m.raw as {
    state?: { score?: { current?: string | null } };
    score?: { fullTime?: { home: number | null; away: number | null } };
  } | null | undefined;
  if (!r) return null;
  if (["Not started", "SCHEDULED", "TIMED"].includes(m.status)) return null; // the match has not started yet
  // Highlightly format: text "2 - 1".
  const hl = r.state?.score?.current;
  if (hl) {
    const [h, a] = hl.split(" - ").map((n) => parseInt(n, 10));
    return Number.isNaN(h) || Number.isNaN(a) ? null : { home: h, away: a };
  }
  // football-data.org format: numbers in score.fullTime.
  const ft = r.score?.fullTime;
  if (ft && ft.home !== null && ft.away !== null) return { home: ft.home, away: ft.away };
  return null;
}

// Knockout stages: football-data.org (stage) and Highlightly (round), translated
const STAGES: Record<string, string> = {
  LAST_32: "Șaisprezecimi",
  LAST_16: "Optimi",
  QUARTER_FINALS: "Sferturi",
  SEMI_FINALS: "Semifinale",
  FINAL: "Finala",
  PLAYOFFS: "Baraj",
};
const MATCH_WORD = "Match"; // the word shown before the round number ("Match 13")

// Name of a knockout stage where the bracket is split in `fraction` parts (1/fraction of the final):
// 1/2 = semi-finals, 1/4 = quarter-finals, 1/8 = round of 16, 1/16 = round of 32; earlier stages are "Tur 1/N".
function cupStage(fraction: number): string {
  if (fraction === 1) return STAGES.FINAL;
  if (fraction === 2) return STAGES.SEMI_FINALS;
  if (fraction === 4) return STAGES.QUARTER_FINALS;
  if (fraction === 8) return STAGES.LAST_16;
  if (fraction === 16) return STAGES.LAST_32;
  return `Tur 1/${fraction}`;
}

/** Round label: any matchday/round number becomes "Match N"; knockout stages are translated. */
export function roundLabel(m: Match): string | null {
  const raw = m.raw as { stage?: string; matchday?: number | null } | null | undefined;
  if (raw?.stage && STAGES[raw.stage]) return STAGES[raw.stage]; // football-data knockout stage

  const r = m.round?.trim(); // Highlightly round text, e.g. "Regular Season - 13"
  if (r) {
    if (/round of 32/i.test(r)) return STAGES.LAST_32;
    if (/round of 16/i.test(r)) return STAGES.LAST_16;
    if (/quarter/i.test(r)) return STAGES.QUARTER_FINALS;
    if (/semi/i.test(r)) return STAGES.SEMI_FINALS;
    if (/^final$/i.test(r)) return STAGES.FINAL;
    if (/play-?offs?|knockout round/i.test(r)) return STAGES.PLAYOFFS;
    const group = r.match(/^League ([A-D])\s*-\s*(\d+)$/i); // Nations League: we keep the league
    if (group) return `Liga ${group[1].toUpperCase()} · ${MATCH_WORD} ${group[2]}`;
    // Cup rounds. "Round of N" and "1/N-finals" both mean the stage with N teams (or 1/N of the bracket).
    const roundOf = r.match(/^Round of (\d+)$/i);
    if (roundOf) return cupStage(Number(roundOf[1]) / 2);
    const fraction = r.match(/^1\/(\d+)-finals?$/i);
    if (fraction) return cupStage(Number(fraction[1]));
    if (/^group stage$/i.test(r)) return "Faza grupelor";
    // Ordinal rounds, e.g. "3rd Round Qualifying", "3rd Round Qualifying Replays", "1st Round"
    const ordinal = r.match(/^(\d+)(?:st|nd|rd|th) round(.*)$/i);
    if (ordinal) {
      const rest = ordinal[2];
      const base = /qualifying/i.test(rest) ? `Calificări · Turul ${ordinal[1]}` : `Turul ${ordinal[1]}`;
      return /replay/i.test(rest) ? `${base} · Rejucare` : base;
    }
    const n = r.match(/(\d+)\s*$/); // trailing number of the round text
    return n ? `${MATCH_WORD} ${n[1]}` : r;
  }
  // No round text: fall back to the matchday number from football-data.
  return raw?.matchday ? `${MATCH_WORD} ${raw.matchday}` : null;
}
