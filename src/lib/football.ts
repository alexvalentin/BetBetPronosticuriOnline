// football-data.org (free plan). Competition codes: docs.football-data.org/general/v4/lookup_tables.html
// Liga 1 (Romania), Europa League, Conference League, Nations League, qualifiers and friendlies are NOT in the free plan.
// Map of competition code -> display name.
export const LEAGUES: Record<string, string> = {
  PL: "Premier League",
  PD: "La Liga",
  BL1: "Bundesliga",
  SA: "Serie A",
  FL1: "Ligue 1",
  CL: "Champions League",
  ELC: "Championship",
  DED: "Eredivisie",
  PPL: "Primeira Liga",
  BSA: "Campionatul Brazilian",
};

// Competitions for which we keep ONLY the table (standings), with no matches/predictions.
export const MATCH_EXCLUDED = ["ELC", "DED", "PPL", "BSA", "242468"]; // 242468 = Liga 2 Romania (table only)

const BASE = "https://api.football-data.org/v4"; // API base URL
// Comma-separated codes of the competitions whose matches we fetch (all leagues minus the excluded ones).
const CODES = Object.keys(LEAGUES).filter((c) => !MATCH_EXCLUDED.includes(c)).join(",");

// A match as returned by the football-data.org API (only the fields we use).
export type Match = {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | EXTRA_TIME | PENALTY_SHOOTOUT | FINISHED | SUSPENDED | POSTPONED | CANCELLED | AWARDED
  competition: { code: string; name: string };
  season: { startDate: string };
  homeTeam: { name: string; crest: string | null };
  awayTeam: { name: string; crest: string | null };
  score: { fullTime: { home: number | null; away: number | null } };
};

// One line of a standings table.
export type StandingRow = {
  position: number;
  team: { id: number; name: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalDifference: number;
};

type StandingsGroup = { stage: string; type: "TOTAL" | "HOME" | "AWAY"; group: string | null; table: StandingRow[] };
export type StandingsResponse = { standings: StandingsGroup[] };

// Generic GET helper for the API: adds the query parameters and the API key, never caches, and throws on errors.
async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY! },
    cache: "no-store",
  });
  if (res.status === 404) return { standings: [] } as unknown as T; // competition with no table right now (e.g. knockout phase, inactive tournament)
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// 1 single request for all tracked competitions, within a date range.
export const fetchMatchesByDateRange = (dateFrom: string, dateTo: string) =>
  api<{ matches: Match[] }>("/matches", { competitions: CODES, dateFrom, dateTo }).then((r) => r.matches);

// 1 single request for all matches that are in progress RIGHT NOW, regardless of the date.
export const fetchLiveMatches = () =>
  api<{ matches: Match[] }>("/matches", {
    competitions: CODES,
    status: "LIVE,IN_PLAY,PAUSED,SUSPENDED",
  }).then((r) => r.matches);

// 1 request per competition.
export const fetchStandings = (code: string) => api<StandingsResponse>(`/competitions/${code}/standings`, {});

// Statuses that mean the match is over.
const FINISHED = new Set(["FINISHED", "AWARDED"]);

// Converts an API match into a row of our `matches` table.
// We score the result after 90 minutes (fullTime), including knockout games with extra time/penalties.
export function toRow(m: Match) {
  const finished = FINISHED.has(m.status);
  return {
    id: m.id,
    league_id: m.competition.code,
    league_name: LEAGUES[m.competition.code] ?? m.competition.name,
    round: null, // this API does not give us a round label
    season: m.season?.startDate ? Number(m.season.startDate.slice(0, 4)) : null,
    home_team: m.homeTeam.name,
    away_team: m.awayTeam.name,
    home_logo: m.homeTeam.crest,
    away_logo: m.awayTeam.crest,
    kickoff_at: m.utcDate,
    status: m.status,
    is_finished: finished,
    home_goals: finished ? m.score.fullTime.home : null, // goals are stored only for finished matches
    away_goals: finished ? m.score.fullTime.away : null,
    raw: m, // the original API object (used for the live score)
    updated_at: new Date().toISOString(),
  };
}
