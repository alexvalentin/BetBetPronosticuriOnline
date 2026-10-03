// football-data.org (planul gratuit). Coduri de competitii: docs.football-data.org/general/v4/lookup_tables.html
// Liga 1 (Romania), Europa League, Conference League, Nations League, preliminarii si amicale NU sunt incluse in planul gratuit.
export const LEAGUES: Record<string, string> = {
  PL: "Premier League",
  PD: "La Liga",
  BL1: "Bundesliga",
  SA: "Serie A",
  FL1: "Ligue 1",
  CL: "Champions League",
};

const BASE = "https://api.football-data.org/v4";
const CODES = Object.keys(LEAGUES).join(",");

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

async function api<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY! },
    cache: "no-store",
  });
  if (res.status === 404) return { standings: [] } as unknown as T; // competitie fara clasament acum (ex: faza eliminatorie, turneu inactiv)
  if (!res.ok) throw new Error(`football-data.org ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

// 1 singur request pentru toate competitiile urmarite, intr-un interval de date
export const fetchMatchesByDateRange = (dateFrom: string, dateTo: string) =>
  api<{ matches: Match[] }>("/matches", { competitions: CODES, dateFrom, dateTo }).then((r) => r.matches);

// 1 singur request pentru toate meciurile aflate ACUM in desfasurare, indiferent de data
export const fetchLiveMatches = () =>
  api<{ matches: Match[] }>("/matches", {
    competitions: CODES,
    status: "IN_PLAY,PAUSED,EXTRA_TIME,PENALTY_SHOOTOUT,SUSPENDED",
  }).then((r) => r.matches);

// 1 request per competitie
export const fetchStandings = (code: string) => api<StandingsResponse>(`/competitions/${code}/standings`, {});

const FINISHED = new Set(["FINISHED", "AWARDED"]);

// Punctam scorul dupa 90 de minute (fullTime), inclusiv la eliminatorii cu prelungiri/penalty-uri.
export function toRow(m: Match) {
  const finished = FINISHED.has(m.status);
  return {
    id: m.id,
    league_id: m.competition.code,
    league_name: LEAGUES[m.competition.code] ?? m.competition.name,
    round: null,
    season: m.season?.startDate ? Number(m.season.startDate.slice(0, 4)) : null,
    home_team: m.homeTeam.name,
    away_team: m.awayTeam.name,
    home_logo: m.homeTeam.crest,
    away_logo: m.awayTeam.crest,
    kickoff_at: m.utcDate,
    status: m.status,
    is_finished: finished,
    home_goals: finished ? m.score.fullTime.home : null,
    away_goals: finished ? m.score.fullTime.away : null,
    raw: m,
    updated_at: new Date().toISOString(),
  };
}
