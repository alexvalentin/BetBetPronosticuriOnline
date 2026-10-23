import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LEAGUES, type StandingRow } from "@/lib/football";

export const dynamic = "force-dynamic";

type StandingsRecord = {
  league_id: string;
  season: number;
  league_name: string;
  data: StandingRow[][];
  updated_at: string;
};

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ liga?: string }>;
}) {
  const { liga } = await searchParams;
  const supabase = await createClient();

  // Competitia primului meci afisat pe pagina Meciuri (aceeasi fereastra: de la -4h fata de acum)
  const { data: firstMatch } = await supabase
    .from("matches")
    .select("league_id")
    .gte("kickoff_at", new Date(Date.now() - 4 * 3600e3).toISOString())
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data } = await supabase.from("standings").select("*").returns<StandingsRecord[]>();

  // Ordinea tab-urilor; ce nu e in lista apare la final
  const order = ["PL", "PD", "BL1", "SA", "FL1", "241617", "242468", "CL", "3337", "722432", "ELC"];
  const names: Record<string, string> = { "241617": "Superliga România", "242468": "Liga 2 România" };
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  const list = (data ?? [])
    .filter((s) => Array.isArray(s.data) && s.data.length > 0)
    .map((s) => ({ ...s, league_name: names[s.league_id] ?? LEAGUES[s.league_id] ?? s.league_name }))
    .sort((a, b) => rank(a.league_id) - rank(b.league_id) || a.league_name.localeCompare(b.league_name));

  const defaultLeague = liga ?? firstMatch?.league_id;
  const selected = list.find((s) => s.league_id === defaultLeague) ?? list[0];

  return (
    <>
      <h1 className="title">Clasamente</h1>

      {!selected ? (
        <p className="muted">Încă nu sunt clasamente. Apar după prima sincronizare.</p>
      ) : (
        <>
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
                        <td>{r.goalDifference > 0 ? `+${r.goalDifference}` : r.goalDifference}</td>
                        <td className="pts">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

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
