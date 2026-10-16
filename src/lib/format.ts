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

// 14.10.2026 19:45 (ora Romaniei)
export const dateTimeShort = (iso: string) =>
  new Date(iso)
    .toLocaleString("ro-RO", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    .replace(",", "");

const LIVE = new Set([
  "IN_PLAY", "PAUSED", "EXTRA_TIME", "PENALTY_SHOOTOUT", "SUSPENDED", // football-data.org
  "In Play", "First half", "Second half", "Half Time", "Extra Time", "Penalties", // Highlightly
]);

// Faza unui meci, pentru cardul din Meciuri:
//  upcoming = nu a inceput | live = in desfasurare | checking = a trecut timpul normal si sursa nu a confirmat inca finalul
//  finished = terminat (confirmat de sursa) | off = amanat/anulat
// "Terminat" vine DOAR de la sursa (is_finished); timpul estimat (90 min + pauza 15 min + prelungiri ~ 2h15) doar opreste LIVE.
const OFF = ["POSTPONED", "Postponed", "CANCELLED", "Cancelled"];
const LIVE_AFTER_MS = 135 * 60e3; // 2h15 de la start
const LIVE_MAX_MS = 4 * 3600e3; // chiar daca sursa zice "in desfasurare", dupa 4h nu mai afisam LIVE

export function matchPhase(m: Match, now: number): "upcoming" | "live" | "checking" | "finished" | "off" {
  if (m.is_finished) return "finished";
  if (OFF.includes(m.status)) return "off";
  const since = now - new Date(m.kickoff_at).getTime();
  if (since < 0) return "upcoming";
  if (since < LIVE_AFTER_MS || (LIVE.has(m.status) && since < LIVE_MAX_MS)) return "live";
  return "checking";
}

export function statusLabel(m: Match, now: number = Date.now()) {
  switch (matchPhase(m, now)) {
    case "finished": return "Meci terminat";
    case "live": return "În desfășurare";
    case "checking": return "Se verifică rezultatul";
    case "off": return m.status === "POSTPONED" || m.status === "Postponed" ? "Amânat" : "Anulat";
    default: return "Programat";
  }
}

export function pointsChip(points: number | null) {
  if (points === null) return null;
  if (points === 3) return { text: "Scor exact +3", tone: "exact" };
  if (points === 1) return { text: "Rezultat corect +1", tone: "ok" };
  return { text: "Greșit 0", tone: "miss" };
}

// Eticheta de puncte pentru Istoric: verde = scor corect, galben = rezultat corect, rosu = gresit
export function historyChip(points: number | null) {
  if (points === null) return null;
  if (points === 3) return { text: "Scor exact +3", tone: "h-exact" };
  if (points === 1) return { text: "Rezultat corect +1", tone: "h-ok" };
  return { text: "Greșit +0", tone: "h-miss" };
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

// Inceputul zilei curente, ora Romaniei (ca instant UTC, in ms)
export function startOfDayRO(now: number) {
  const key = dayKey(new Date(now).toISOString());
  const utcMidnight = Date.parse(`${key}T00:00:00Z`);
  for (const off of [3, 2]) {
    const t = utcMidnight - off * 3600e3;
    if (dayKey(new Date(t).toISOString()) === key && dayKey(new Date(t - 1).toISOString()) !== key) return t;
  }
  return utcMidnight - 3 * 3600e3;
}
