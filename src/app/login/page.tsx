import { requestCode, verifyCode } from "@/app/actions";

const ERRORS: Record<string, string> = {
  email: "Introdu adresa de email.",
  send: "Nu am putut trimite codul. Emailul trebuie să fie pe lista de invitați. Dacă e, așteaptă un minut și încearcă din nou.",
  code: "Cod greșit sau expirat. Cere un cod nou.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email, error } = await searchParams;

  return (
    <main className="login">
      <h1 className="title">Pronosticuri</h1>
      {error && ERRORS[error] && <p className="notice" role="alert">{ERRORS[error]}</p>}

      {email ? (
        <form action={verifyCode}>
          <p>Am trimis un cod la <b>{email}</b>. Introdu-l mai jos.</p>
          <input type="hidden" name="email" value={email} />
          <label htmlFor="token">Cod din email</label>
          <input
            id="token"
            name="token"
            className="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            required
          />
          <button className="btn wide" type="submit">Intră în cont</button>
          <p className="small"><a href="/login">Folosește alt email</a></p>
        </form>
      ) : (
        <form action={requestCode}>
          <p>Accesul e doar pe invitație. Introdu emailul cu care ai fost invitat.</p>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" className="text" autoComplete="email" required />
          <button className="btn wide" type="submit">Trimite codul</button>
        </form>
      )}
    </main>
  );
}
