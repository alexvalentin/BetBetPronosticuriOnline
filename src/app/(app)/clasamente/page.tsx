import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LEAGUES, type StandingRow } from "@/lib/football";

export const dynamic = "force-dynamic"; // always render fresh data, never cache

// A row of the `standings` table: one competition, its tables (one per group) and the last update time.
type StandingsRecord = {
  league_id: string;
  season: number;
  league_name: string;
  data: StandingRow[][];
  updated_at: string;
};

// "Clasamente" page: league tables, with one tab (chip) per competition.
export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ liga?: string }>;
}) {
  const { liga } = await searchParams; // selected competition from the URL (?liga=...)
  const supabase = await createClient();

  // Competition of the first match shown on the Meciuri page (same window: from -4h before now)
  const { data: firstMatch } = await supabase
    .from("matches")
    .select("league_id")
    .gte("kickoff_at", new Date(Date.now() - 4 * 3600e3).toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data } = await supabase.from("standings").select("*").returns<StandingsRecord[]>();

  // Order of the tabs; whatever is not in the list appears at the end
  const order = ["PL", "PD", "BL1", "SA", "FL1", "241617", "242468", "CL", "3337", "722432", "ELC"];
  const names: Record<string, string> = { "241617": "Superliga România", "242468": "Liga 2 România" }; // display-name overrides
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  // Keep only competitions that have a table, fix their names and sort them.
  const list = (data ?? [])
    .filter((s) => Array.isArray(s.data) && s.data.length > 0)
    .map((s) => ({ ...s, league_name: names[s.league_id] ?? LEAGUES[s.league_id] ?? s.league_name }))
    .sort((a, b) => rank(a.league_id) - rank(b.league_id) || a.league_name.localeCompare(b.league_name));

  // Which tab is open: the one in the URL, else the competition of the next match, else the first one.
  const defaultLeague = liga ?? firstMatch?.league_id;
  const selected = list.find((s) => s.league_id === defaultLeague) ?? list[0];

  return (
    <>
      <h1 className="title">Clasamente</h1>

      {!selected ? (
        <p className="muted">Încă nu sunt clasamente. Apar după prima sincronizare.</p>
      ) : (
        <>
          {/* Competition tabs */}
          <nav className="chips" aria-label="Competiții">
            {list.map((s) => (
              <Link
                key={`${s.league_id}-${s.season}`}
                href={`/clasamente?liga=${s.league_id}`}
                aria-current={s.league_id === selected.league_id ? "page" : undefined}
              >
                {s.league_name}
              </Link>
            ))}
          </nav>

          {/* One table per group (most leagues have a single group) */}
          {selected.data.map((group, gi) => (
            <section key={gi}>
              <div className="tablewrap">
                <table className="table standings">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Echipă</th>
                      <th title="Meciuri jucate">J</th>
                      <th title="Victorii">V</th>
                      <th title="Egaluri">E</th>
                      <th title="Înfrângeri">Î</th>
                      <th title="Golaveraj">GD</th>
                      <th>P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((r) => (
                      <tr key={r.team.id}>
                        <td className="rank">{r.position}</td>
                        <td className="teamcell">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <div className="teamwrap">
                            <img src={r.team.crest} alt="" width={20} height={20} loading="lazy" />
                            <span className="teamname">{r.team.name}</span>
                          </div>
                        </td>
                        <td>{r.playedGames}</td>
                        <td>{r.won}</td>
                        <td>{r.draw}</td>
                        <td>{r.lost}</td>
                        {/* goal difference, with a "+" sign when positive */}
                        <td>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                        <td className="pts">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {/* Last update time of the selected table (Romania time) */}
          <p className="muted small">
            Actualizat{" "}
            {new Date(selected.updated_at).toLocaleString("ro-RO", {
              timeZone: "Europe/Bucharest",
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Tabelul se reîmprospătează o dată pe zi.
          </p>
        </>
      )}
    </>
  );
}
