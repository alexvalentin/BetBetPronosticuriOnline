import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  wrong: number;
  settled: number;
};

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leaderboard")
    .select("*")
    .order("total_points", { ascending: false })
    .order("exact_scores", { ascending: false })
    .returns<Row[]>();

  return (
    <>
      <h1 className="title">Clasament</h1>
      <div className="tablewrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Jucător</th>
              <th>Puncte</th>
              <th title="Scoruri exacte">Exacte</th>
              <th title="Rezultat corect, scor greșit">Rezultat</th>
              <th>Greșite</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r, i) => (
              <tr key={r.user_id}>
                <td>{i + 1}</td>
                <td>{r.display_name}</td>
                <td className="pts">{r.total_points}</td>
                <td>{r.exact_scores}</td>
                <td>{r.correct_results}</td>
                <td>{r.wrong}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">Scor exact 3 puncte, rezultat corect (1/X/2) 1 punct, greșit 0. Se ia în calcul scorul după 90 de minute.</p>
    </>
  );
}
