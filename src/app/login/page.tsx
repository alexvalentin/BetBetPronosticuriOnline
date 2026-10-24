import { requestCode, verifyCode } from "@/app/actions";

// Error messages (Romanian) shown when the URL carries ?error=<key>.
const ERRORS: Record<string, string> = {
  email: "Introdu adresa de email.",
  send: "Nu am putut trimite codul. Emailul trebuie să fie pe lista de invitați. Dacă e, așteaptă un minut și încearcă din nou.",
  code: "Cod greșit sau expirat. Cere un cod nou.",
};

// Login page, in two steps: 1) the email is typed, 2) the code received by email is typed.
// The URL decides the step: with ?email=... we show the code form.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string; notice?: string }>;
}) {
  const { email, error, notice } = await searchParams;

  return (
    <main className="login">
      <h1 className="title">Cinci-Zero</h1>
      {error && ERRORS[error] && <p className="notice" role="alert">{ERRORS[error]}</p>}

      {/* Shown when Supabase refused to send a new email because of its rate limit */}
      {email && notice === "limit" && (
        <p className="notice notice-ok">
          Ai cerut deja un cod acum câteva momente, iar un cod nou nu se poate trimite încă. Folosește ultimul cod primit pe email sau așteaptă un minut și cere altul.
        </p>
      )}

      {email ? (
        // Step 2: enter the code
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
        // Step 1: enter the email
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
