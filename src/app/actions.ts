"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Reads a goals field from a form: returns an integer from 0 to 20, or null if empty/invalid.
function goals(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 20 ? n : null;
}

// Login step 1: send a one-time code to the email address.
export async function requestCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=email");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    // The real error stays in the Vercel logs; the user sees a clear message.
    console.error("signInWithOtp", error.status, error.code, error.message);
    // Email limit reached: a code sent recently is still valid, so we go to the code entry page.
    const limited =
      error.status === 429 || /rate.?limit|security purposes|only request this/i.test(`${error.code ?? ""} ${error.message}`);
    if (limited) redirect(`/login?email=${encodeURIComponent(email)}&notice=limit`);
    redirect("/login?error=send");
  }

  redirect(`/login?email=${encodeURIComponent(email)}`);
}

// Login step 2: check the code typed by the user and open the session.
export async function verifyCode(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("token") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) redirect(`/login?email=${encodeURIComponent(email)}&error=code`);

  redirect("/");
}

// Logs the user out and goes back to the login page.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Saves (creates or edits) the logged-in user's prediction for one match.
export async function savePrediction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const matchId = Number(formData.get("match_id"));
  const home = goals(formData.get("home"));
  const away = goals(formData.get("away"));
  if (!Number.isInteger(matchId) || home === null || away === null) redirect("/?error=invalid");

  // Blocking at the start of the match is enforced by the RLS policies in the database.
  // First try to update an existing prediction...
  const { data: updated, error: updateError } = await supabase
    .from("predictions")
    .update({ home_goals: home, away_goals: away })
    .eq("user_id", user.id)
    .eq("match_id", matchId)
    .select("id");
  if (updateError) redirect("/?error=locked");

  // ...and if there was none, create a new one.
  if (!updated?.length) {
    const { error: insertError } = await supabase
      .from("predictions")
      .insert({ user_id: user.id, match_id: matchId, home_goals: home, away_goals: away });
    if (insertError) redirect("/?error=locked");
  }

  revalidatePath("/"); // reload the Meciuri page data
}

// Changes the display name of the logged-in user (1-24 characters).
export async function updateDisplayName(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("display_name") ?? "").trim();
  if (!name || name.length > 24) redirect("/setari?error=invalid");

  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
  if (error) redirect("/setari?error=save");

  revalidatePath("/", "layout"); // the name is shown in the top bar of every page
  redirect("/setari?saved=1");
}
