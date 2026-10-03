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
};

export type Prediction = {
  match_id: number;
  home_goals: number;
  away_goals: number;
  points: number | null;
};
