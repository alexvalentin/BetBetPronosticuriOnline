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

  const order = Object.keys(LEAGUES);
  const list = (data ?? [])
    .filter((s) => Array.isArray(s.data) && s.data.length > 0)
    .sort((a, b) => order.indexOf(a.league_id) - order.indexOf(b.league_id));

  const defaultLeague = liga ?? firstMatch?.league_id;
  const selected = list.find((s) => s.league_id === defaultLeague) ?? list[0];

  return (
    <>
      <h1 className="title">Tabele</h1>

      {!selected ? (
        <p className="muted">Încă nu sunt tabele. Apar după prima sincronizare a clasamentelor.</p>
      ) : (
        <>
          <nav className="chips" aria-label="Competiții">
            {list.map((s) => (
              <Link
                key={`${s.league_id}-${s.season}`}
                href={`/tabele?liga=${s.league_id}`}
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
                          <img src={r.team.crest} alt="" width={20} height={20} loading="lazy" />
                          {r.team.name}
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
