import { createClient } from "@/lib/supabase/server";
import { updateDisplayName } from "@/app/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Numele trebuie să aibă între 1 și 24 de caractere.",
  save: "Nu am putut salva numele. Încearcă din nou.",
};

export default async function SetariPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).single()
    : { data: null };

  return (
    <>
      <h1 className="title">Setări</h1>

      {error && ERRORS[error] && <p className="notice" role="alert">{ERRORS[error]}</p>}
      {saved && <p className="notice notice-ok">Numele a fost salvat.</p>}

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
        <p className="muted small">Apare în loc de email, pe Clasament, Istoric și la meciuri.</p>
        <button className="btn" type="submit">Salvează</button>
      </form>
    </>
  );
}
