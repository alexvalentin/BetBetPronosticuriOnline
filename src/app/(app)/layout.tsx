import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).single()
    : { data: null };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Pronosticuri</span>
          <form action={signOut} className="who">
            <Link href="/setari">{profile?.display_name}</Link>
            <button className="linkbtn" type="submit">Ieși din cont</button>
          </form>
        </div>
        <div className="topbar-inner">
          <Nav />
        </div>
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
