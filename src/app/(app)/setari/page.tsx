import { createClient } from "@/lib/supabase/server";
import { updateDisplayName } from "@/app/actions";
import ThemeSetting from "@/components/ThemeSetting";

export const dynamic = "force-dynamic"; // always render fresh data, never cache

// Error messages (Romanian) shown when the URL carries ?error=<key>.
const ERRORS: Record<string, string> = {
  invalid: "Numele trebuie să aibă între 1 și 24 de caractere.",
  save: "Nu am putut salva numele. Încearcă din nou.",
};

// "Setări" page: change the display name and choose the theme.
export default async function SetariPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Current display name, to prefill the field.
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).single()
    : { data: null };

  return (
    <>
      <h1 className="title">Setări</h1>

      {error && ERRORS[error] && <p className="notice" role="alert">{ERRORS[error]}</p>}
      {saved && <p className="notice notice-ok">Numele a fost salvat.</p>}

      {/* Display-name form (handled by the updateDisplayName server action) */}
      <form action={updateDisplayName} className="settings-form">
        <label htmlFor="display_name">Numele afișat prietenilor</label>
        <input
          id="display_name"
          name="display_name"
          className="text"
          defaultValue={profile?.display_name ?? ""}
          maxLength={24}
          required
          autoComplete="off"
        />
        <p className="muted small">Apare în loc de email, pe Punctaj, Rezultate și la meciuri.</p>
        <button className="btn" type="submit">Salvează</button>
      </form>

      <ThemeSetting />
    </>
  );
}
