// Highlightly (plan gratuit BASIC, 100 request-uri/zi). Sursa secundara, pentru competitiile
// care nu exista pe football-data.org: Liga 1, Liga 2, Europa League, Conference League, Nations League.
// ID-urile sunt numerice, confirmate manual (vezi conversatia de testare), nu se pot cauta automat la runtime.
export const LEAGUES: Record<string, string> = {
  "241617": "Liga 1",
  "242468": "Liga 2",
  "3337": "Europa League",
  "722432": "Conference League",
  "5039": "Nations League",
};

const SEASON = 2026; // sezonul curent la toate cele 5 competitii, verificat manual
const BASE = "https://soccer.highlightly.net";

function authHeaders() {
  return { "x-rapidapi-key": process.env.HIGHLIGHTLY_API_KEY! };
}

export type HMatch = {
  id: number;
  round: string | null;
  date: string;
  state: { clock: number | null; description: string; score: { current: string | null } };
  homeTeam: { id: number; name: string; logo: string | null };
  awayTeam: { id: number; name: string; logo: string | null };
  league: { id: number; name: string; season: number };
};

// Endpoint-urile /matches si /leagues vin invelite in { data: [...] }
async function apiData<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Highlightly ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: T[] };
  return json.data ?? [];
}

// 1 request per competitie per zi (Highlightly cere leagueId + date, nu accepta interval)
export const fetchMatchesByDate = (leagueId: string, date: string) =>
  apiData<HMatch>("/matches", { leagueId, date });

type HStandingRow = {
  position: number;
  points: number;
  team: { id: number; name: string; logo: string };
  total: { games: number; wins: number; draws: number; loses: number; scoredGoals: number; receivedGoals: number };
};
type HStandingsResponse = { groups: { name: string; standings: HStandingRow[] }[] };

// /standings NU are wrapper "data" (confirmat manual) - vine direct {groups:[...], league:{...}}
async function fetchStandingsGroups(leagueId: string): Promise<HStandingsResponse["groups"]> {
  const url = new URL(BASE + "/standings");
  url.searchParams.set("leagueId", leagueId);
  url.searchParams.set("season", String(SEASON));
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Highlightly ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as HStandingsResponse;
  return json.groups ?? [];
}

// Normalizam in acelasi format StandingRow[][] folosit si de football-data.org,
// ca pagina Tabele sa nu aiba nevoie de cod separat pentru fiecare sursa.
export async function fetchStandings(leagueId: string) {
  const groups = await fetchStandingsGroups(leagueId);
  return groups.map((g) =>
    g.standings.map((r) => ({
      position: r.position,
      points: r.points,
      team: { id: r.team.id, name: r.team.name, crest: r.team.logo },
      playedGames: r.total.games,
      won: r.total.wins,
      draw: r.total.draws,
      lost: r.total.loses,
      goalDifference: r.total.scoredGoals - r.total.receivedGoals,
    }))
  );
}

const FINISHED = new Set(["Finished", "Full Time", "After Extra Time", "Penalties"]);

// Highlightly da scorul ca text "3 - 1"; id-ul e stocat negativ, ca sa nu se poata suprapune
// peste vreun id de la football-data.org (care sunt mereu pozitive).
export function toRow(m: HMatch, leagueId: string) {
  const finished = FINISHED.has(m.state.description);
  const [h, a] = (m.state.score.current ?? "").split(" - ").map((n) => parseInt(n, 10));
  return {
    id: -m.id,
    league_id: leagueId,
    league_name: LEAGUES[leagueId] ?? m.league.name,
    round: m.round,
    season: m.league.season,
    home_team: m.homeTeam.name,
    away_team: m.awayTeam.name,
    home_logo: m.homeTeam.logo,
    away_logo: m.awayTeam.logo,
    kickoff_at: m.date,
    status: m.state.description,
    is_finished: finished,
    home_goals: finished && !Number.isNaN(h) ? h : null,
    away_goals: finished && !Number.isNaN(a) ? a : null,
    raw: m,
    source: "highlightly",
    updated_at: new Date().toISOString(),
  };
}
