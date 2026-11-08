# Cinci-Zero

Site privat de pronosticuri de fotbal între prieteni. Fără bani, doar puncte.
Next.js + Supabase + football-data.org + Highlightly, instalabil pe telefon (PWA).

Structura completă (pagini, fișiere, baza de date, sincronizări) e în [STRUCTURA.md](STRUCTURA.md).

## Ce face
- Pronostic de scor pentru meciurile de azi și mâine din: Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, Superliga României, Europa League, Conference League, Nations League și cupele naționale (Cupa României, FA Cup, Copa del Rey, DFB Pokal, Coupe de France, Coppa Italia).
- La cupele naționale apar doar meciurile cu echipe mari ale țării respective sau cele de la sferturi în sus.
- Pronosticul se blochează la ora de start, verificat în baza de date (nu pe telefon).
- Pronosticurile celorlalți se văd abia după startul meciului.
- Puncte: scor exact 3, rezultat corect (1/X/2) 1, greșit 0. Se ia scorul după 90 de minute.
- **Meciuri**: cardurile cu scor live, status (LIVE, TERMINAT) și runda, plus căutare după echipă.
- **Rezultate**: meciurile terminate, cu pronosticurile tuturor.
- **Clasamente**: tabelul fiecărei competiții (campionatele, nu cupele).
- **Punctaj**: clasamentul prietenilor.
- **Setări**: numele afișat și tema (automată, luminoasă sau întunecată).
- Acces doar pe invitație, cu cod primit pe email.

## Instalare

1. **Supabase**: creează un proiect gratuit, apoi rulează `supabase/schema.sql` în SQL Editor.
   Dacă ai o schemă veche, rulează și migrările din `supabase/migration_*.sql`.
2. **Invitații**: în SQL Editor adaugă emailurile:
   `insert into public.allowed_emails (email) values ('tu@exemplu.ro'), ('prieten@exemplu.ro');`
3. **Email cu cod**: Authentication, Emails: adaugă `{{ .Token }}` în șabloanele **Magic Link** și **Confirm signup**. Dacă apare „Set up custom SMTP”, configurează un SMTP propriu (de exemplu Gmail cu parolă de aplicație).
4. **Chei API**: cont gratuit la football-data.org (My Account, API Token) și la highlightly.net (Dashboard, API key).
5. Copiază `.env.example` în `.env.local` și completează valorile.
6. `npm install` apoi `npm run dev`.

## Sincronizarea meciurilor
Rute: `/api/cron/sync` (football-data.org) și `/api/cron/sync-highlightly` (Highlightly), cu `?mode=upcoming|live|standings` și headerul `Authorization: Bearer <CRON_SECRET>`.

- `upcoming`: o dată pe zi, programul meciurilor (GitHub Actions).
- `standings`: o dată pe zi, clasamentele (GitHub Actions).
- `live`: scorul și finalul, la 5 minute (football-data) și 10 minute (Highlightly), din Supabase `pg_cron`. Se oprește singur când nu e niciun meci în desfășurare.

Programul zilnic e în `.github/workflows/sync.yml`. Adaugă în repo secretele `SITE_URL` și `CRON_SECRET`. Orele sunt în UTC și trebuie ajustate la schimbarea orei.

Programarea live din Supabase, în SQL Editor (înlocuiește `<SITE>` și `<CRON_SECRET>`):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('sync-football-live', '*/5 6-23 * * *', $$
  select net.http_get(
    url := '<SITE>/api/cron/sync?mode=live',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    timeout_milliseconds := 30000);
$$);

select cron.schedule('sync-highlightly-live', '*/10 6-23 * * *', $$
  select net.http_get(
    url := '<SITE>/api/cron/sync-highlightly?mode=live',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    timeout_milliseconds := 30000);
$$);
```

Nu pune secretul în Git. Verificarea: `select status_code, created from net._http_response order by created desc limit 6;` (200 înseamnă că merge).

Prima dată, pornește manual `upcoming`, apoi `standings` (Actions, Run workflow), ca să apară meciurile și clasamentele.

## Limite de cunoscut
- football-data.org (plan gratuit): 10 cereri pe minut; uneori întârzie cu statusul și scorul meciurilor.
- Highlightly (plan gratuit): 100 de cereri pe zi, de urmărit în serile cu Europa League și Conference League simultan.

## Deploy
Vercel (plan gratuit): importă repo-ul și adaugă aceleași variabile de mediu. Pe telefon: „Adaugă pe ecranul principal”.

## De făcut mai departe
- Interval adaptiv pentru sincronizarea Highlightly (10, 15 sau 20 de minute după numărul de competiții live), dacă se atinge limita zilnică.
- O pagină cu tabloul eliminatoriu al cupelor.
- Notificări „mai ai 1 oră până la meci” (cere service worker).
- Backup periodic al bazei de date.
