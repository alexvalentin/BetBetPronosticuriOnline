// A row of the `matches` table, as the pages use it.
export type Match = {
  id: number;
  league_id: string;
  league_name: string;
  round: string | null;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  kickoff_at: string;
  status: string;
  is_finished: boolean;
  home_goals: number | null;
  away_goals: number | null;
  finished_at?: string | null; // when it was first seen as finished
  raw?: unknown; // the full API response (contains the current score during the match)
};

// A user's prediction for one match (points stay null until the match is settled).
export type Prediction = {
  match_id: number;
  home_goals: number;
  away_goals: number;
  points: number | null;
};
