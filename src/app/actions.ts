"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function goals(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : null;
}

export async function requestCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=email");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) redirect("/login?error=send");

  redirect(`/login?email=${encodeURIComponent(email)}`);
}

export async function verifyCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) redirect(`/login?email=${encodeURIComponent(email)}&error=code`);

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function savePrediction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const matchId = Number(formData.get("match_id"));
  const home = goals(formData.get("home"));
  const away = goals(formData.get("away"));
  if (!Number.isInteger(matchId) || home === null || away === null) redirect("/?error=invalid");

  // Blocarea la startul meciului e impusa de politicile RLS din baza de date.
  const { data: updated, error: updateError } = await supabase
    .from("predictions")
    .update({ home_goals: home, away_goals: away })
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .select("id");
  if (updateError) redirect("/?error=locked");

  if (!updated?.length) {
    const { error: insertError } = await supabase
      .from("predictions")
      .insert({ user_id: user.id, match_id: matchId, home_goals: home, away_goals: away });
    if (insertError) redirect("/?error=locked");
  }

  revalidatePath("/");
}

export async function updateDisplayName(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("display_name") ?? "").trim();
  if (!name || name.length > 24) redirect("/setari?error=invalid");

  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  if (error) redirect("/setari?error=save");

  revalidatePath("/", "layout");
  redirect("/setari?saved=1");
}
