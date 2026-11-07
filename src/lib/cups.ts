// Filter for domestic cups: we keep a cup match only if
//  - it belongs to the quarter-finals or a later stage (quarter-finals, semi-finals, final), or
//  - at least one of the two teams is a "big" team of that country (lists below).
// The filter is applied when matches are saved, so other cup matches never reach the database.
// Competitions that are not in BIG_TEAMS (leagues, European cups) are never filtered.

// Minimal shape of a Highlightly match that the filter needs.
export type CupMatch = { round: string | null; homeTeam: { name: string }; awayTeam: { name: string } };

// Highlightly league id -> canonical names of the big teams (see canon() for how names are normalized).
export const BIG_TEAMS: Record<string, string[]> = {
  // Cupa României
  "243319": ["fcsb", "cfr cluj", "rapid", "rapid bucuresti", "dinamo", "dinamo bucuresti", "universitatea craiova", "u craiova", "craiova", "universitatea cluj", "u cluj"],
  // FA Cup
  "39079": ["manchester city", "man city", "manchester united", "man united", "man utd", "liverpool", "arsenal", "chelsea", "tottenham", "tottenham hotspur"],
  // Copa del Rey
  "122477": ["barcelona", "real madrid", "atletico madrid", "atletico de madrid", "club atletico de madrid", "athletic club", "athletic bilbao", "valencia"],
  // DFB Pokal
  "69715": ["bayern munchen", "bayern munich", "bayern", "borussia dortmund", "dortmund", "bayer leverkusen", "leverkusen", "rb leipzig", "leipzig"],
  // Coupe de France
  "56950": ["paris saint-germain", "paris saint germain", "paris sg", "psg", "marseille", "olympique de marseille", "olympique marseille", "lyon", "olympique lyonnais", "monaco", "lille"],
  // Coppa Italia
  "117371": ["juventus", "inter", "inter milan", "internazionale", "internazionale milano", "milan", "napoli", "roma", "lazio", "atalanta"],
};

// Normalizes a team name so that "FC Internazionale Milano", "Internazionale" and "Inter" compare easily:
// removes accents and punctuation, lowercases, and drops common club words (fc, ac, as, ...) and numbers.
export function canon(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents and umlauts: ü -> u, é -> e, ş -> s
    .toLowerCase()
    // letters that are not "letter + accent", so they need an explicit replacement
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .replace(/ı/g, "i")
    .replace(/[.'’]/g, "")
    .replace(/\b(fc|cf|afc|ac|sc|ssc|as|ss|us|rc|rcd|ca|cd|sv|bsc|vfl|vfb|fk|ud|sk|bc|osc)\b/g, " ")
    .replace(/\b\d+\b/g, " ") // numbers such as 04, 1899, 1907, 1909
    .replace(/\s+/g, " ")
    .trim();
}

// True for the quarter-finals and every later stage ("Quarter-finals", "Semi-finals", "Final", "Round of 8", "1/4-finals", ...).
export function isQuarterOrLater(round: string | null): boolean {
  const r = (round ?? "").trim();
  if (!r) return false;
  if (/quarter|semi/i.test(r) || /^final$/i.test(r)) return true;
  const roundOf = r.match(/^Round of (\d+)$/i); // "Round of 8" = quarter-finals, "Round of 4" = semi-finals
  if (roundOf) return Number(roundOf[1]) <= 8;
  const fraction = r.match(/^1\/(\d+)-finals?$/i); // "1/4-finals" = quarter-finals
  if (fraction) return Number(fraction[1]) <= 4;
  return false;
}

// Decides if a match of the given competition is kept. Competitions without a team list are always kept.
export function keepCupMatch(m: CupMatch, leagueId: string): boolean {
  const big = BIG_TEAMS[leagueId];
  if (!big) return true; // not a filtered cup
  if (isQuarterOrLater(m.round)) return true;
  return [m.homeTeam.name, m.awayTeam.name].some((n) => big.includes(canon(n)));
}
