import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncFootballLive, syncHighlightlyLive } from "@/lib/sync-live";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Reimprospatare la vizita: doar pentru useri logati. Sincronizarea se opreste singura daca nu e niciun meci
// in desfasurare sau daca s-a rulat acum mai putin de 4 minute, deci nu se multiplica odata cu numarul de vizitatori.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const results = await Promise.allSettled([syncFootballLive(db, false), syncHighlightlyLive(db, false)]);
  const updated = results.some((r) => r.status === "fulfilled" && r.value.saved > 0);
  return NextResponse.json({ updated });
}
