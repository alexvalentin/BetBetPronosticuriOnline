import type { Match } from "./types";

const TZ = "Europe/Bucharest";

export const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

export function dayLabel(iso: string) {
  const s = new Date(iso).toLocaleDateString("ro-RO", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("ro-RO", { timeZone: "Europe/Bucharest", day: "numeric", month: "long", year: "numeric" });

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("ro-RO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

const LIVE = new Set([
  "IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT", "SUSPENDED", // football-data.org
  "In Play", "Half Time", "Extra Time", "Penalties", // Highlightly
]);

export function statusLabel(m: Match) {
  if (m.is_finished) return "Terminat";
  if (LIVE.has(m.status)) return "În desfășurare";
  if (m.status === "POSTPONED" || m.status === "Postponed") return "Amânat";
  if (m.status === "CANCELLED" || m.status === "Cancelled") return "Anulat";
  return "A început";
}

export function pointsChip(points: number | null) {
  if (points === null) return null;
  if (points === 3) return { text: "Scor exact +3", tone: "exact" };
  if (points === 1) return { text: "Rezultat corect +1", tone: "ok" };
  return { text: "Greșit 0", tone: "miss" };
}

// Explica pe scurt de ce un pronostic a primit punctele respective, comparand predictia cu rezultatul real
export function predictionReason(
  pick: { home_goals: number; away_goals: number; points: number | null },
  match: { home_goals: number | null; away_goals: number | null }
) {
  if (pick.points === null || match.home_goals === null || match.away_goals === null) return null;
  if (pick.points === 3) return "Scor exact!";
  if (pick.points === 1) {
    const predicted = pick.home_goals === pick.away_goals ? "draw" : pick.home_goals > pick.away_goals ? "home" : "away";
    return predicted === "draw" ? "Egal ghicit, dar scorul nu." : "Echipa castigatoare ghicita, dar nu si scorul.";
  }
  return "Nici rezultatul, nici scorul nu au fost corecte.";
}
