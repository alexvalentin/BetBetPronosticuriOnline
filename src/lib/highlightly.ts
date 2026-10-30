// Highlightly (free BASIC plan, 100 requests/day). Secondary source, for competitions
// that do not exist on football-data.org: Liga 1, Liga 2, Europa League, Conference League, Nations League.
// The ids are numeric, confirmed manually (see the testing conversation); they cannot be looked up automatically at runtime.
// Map of Highlightly league id -> display name.
export const LEAGUES: Record<string, string> = {
  "241617": "Superliga România",
  "242468": "Liga 2 România",
  "3337": "Europa League",
  "722432": "Conference League",
  "5039": "Nations League",
  // Domestic cups (no standings table, matches only). Ids confirmed through the /leagues endpoint.
  "243319": "Cupa României",
  "39079": "FA Cup",
  "122477": "Copa del Rey",
  "69715": "DFB Pokal",
  "56950": "Coupe de France",
  "117371": "Coppa Italia",
};

// Ids of the competitions that are cups: they have no standings table, so we never request one for them.
export const CUP_IDS = new Set(["243319", "39079", "122477", "69715", "56950", "117371"]);

const SEASON = 2026; // current season for all 5 competitions, checked manually
const BASE = "https://soccer.highlightly.net"; // API base URL

// Authentication header sent with every request (the key lives in an environment variable).
function authHeaders() {
  return { "x-rapidapi-key": process.env.HIGHLIGHTLY_API_KEY! };
}

// A match as returned by the Highlightly API (only the fields we use).
export type HMatch = {
  id: number;
  round: string | null;
  date: string;
  state: { clock: number | null; description: string; score: { current: string | null } };
  homeTeam: { id: number; name: string; logo: string | null };
  awayTeam: { id: number; name: string; logo: string | null };
  league: { id: number; name: string; season: number };
};

// The /matches and /leagues endpoints come wrapped in { data: [...] }. Generic GET helper that unwraps it.
async function apiData<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Highlightly ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: T[] };
  return json.data ?? [];
}

// 1 request per competition per day (Highlightly requires leagueId + date, it does not accept a range).
export const fetchMatchesByDate = (leagueId: string, date: string) =>
  apiData<HMatch>("/matches", { leagueId, date });

// One line of a Highlightly standings table.
type HStandingRow = {
  position: number;
  points: number;
  team: { id: number; name: string; logo: string };
  total: { games: number; wins: number; draws: number; loses: number; scoredGoals: number; receivedGoals: number };
};
type HStandingsResponse = { groups: { name: string; standings: HStandingRow[] }[] };

// /standings does NOT have the "data" wrapper (confirmed manually) - it comes directly as {groups:[...], league:{...}}
async function fetchStandingsGroups(leagueId: string): Promise<HStandingsResponse["groups"]> {
  const url = new URL(BASE + "/standings");
  url.searchParams.set("leagueId", leagueId);
  url.searchParams.set("season", String(SEASON));
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`Highlightly ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as HStandingsResponse;
  return json.groups ?? [];
}

// We normalize to the same StandingRow[][] format used by football-data.org,
// so the Clasamente page does not need separate code for each source.
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

// Status descriptions that mean the match is over.
const FINISHED = new Set(["Finished", "Full Time", "After Extra Time", "Penalties"]);

// Highlightly gives the score as text "3 - 1"; the id is stored as a negative number, so it can never
// overlap an id from football-data.org (which are always positive).
// Converts an API match into a row of our `matches` table.
export function toRow(m: HMatch, leagueId: string) {
  const finished = FINISHED.has(m.state.description);
  // Split "3 - 1" into [3, 1] (NaN if the score is missing).
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
    home_goals: finished && !Number.isNaN(h) ? h : null, // goals are stored only for finished matches
    away_goals: finished && !Number.isNaN(a) ? a : null,
    raw: m, // the original API object (used for the live score and minute)
    source: "highlightly",
    updated_at: new Date().toISOString(),
  };
}
