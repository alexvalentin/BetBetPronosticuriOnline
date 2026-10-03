# Pronosticuri

Site privat de pronosticuri de fotbal între prieteni. Fără bani, doar puncte.
Next.js + Supabase + football-data.org, instalabil pe telefon (PWA).

## Ce face
- Pronostic de scor pentru meciurile din Premier League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, World Cup și Euro.
- Pronosticul se blochează la ora de start, verificat în baza de date (nu pe telefon).
- Pronosticurile celorlalți se văd abia după startul meciului.
- Puncte: scor exact 3, rezultat corect (1/X/2) 1, greșit 0. Se ia scorul după 90 de minute.
- Clasament și istoric cu pronosticurile tuturor pe fiecare meci terminat.
- **Tabele**: clasamentul fiecărei competiții urmărite, reîmprospătat o dată pe zi.
- Acces doar pe invitație, autentificare cu cod primit pe email.

## Important: competiții neacoperite de planul gratuit
Planul gratuit de la **football-data.org** acoperă doar 12 competiții fixe. Din lista inițială dorită, **nu sunt disponibile gratuit**: Liga 1 (România), Europa League, Conference League, și meciurile naționale în afara World Cup/Euro (preliminarii, Nations League, amicale).

Planul gratuit **API-Football** ar fi acoperit toate aceste competiții, dar nu oferă acces la sezonul curent (doar sezoane mai vechi), deci nu era folositor pentru meciurile de acum. Dacă la un moment dat vrei toate competițiile din lista inițială, varianta e planul **Pro de la API-Football (19 $/lună)** — vezi discuția din conversație pentru detalii, codul s-ar rescrie pentru el.

## Instalare

1. **Supabase**: creează un proiect gratuit, apoi rulează `supabase/schema.sql` în SQL Editor.
   - Dacă ai rulat deja o schemă veche (cu `league_id` ca număr, varianta API-Football), rulează în plus `supabase/migration_footballdata.sql`.
2. **Invitații**: în SQL Editor adaugă emailurile:
   `insert into public.allowed_emails (email) values ('tu@exemplu.ro'), ('prieten@exemplu.ro');`
3. **Email cu cod**: Authentication -> Emails: deschide șabloanele **Magic Link** și **Confirm signup**, adaugă `{{ .Token }}` în corpul mesajului. Dacă apare mesajul "Set up custom SMTP to edit templates", configurează mai întâi un SMTP propriu (Authentication -> Emails -> SMTP Settings) — de exemplu Gmail, gratuit, cu o parolă de aplicație generată la myaccount.google.com/apppasswords.
4. **football-data.org**: cont gratuit pe football-data.org, secțiunea **My Account** → copiază **API Token**.
5. Copiază `.env.example` în `.env.local` și completează valorile.
6. `npm install` apoi `npm run dev`.

## Sincronizarea meciurilor
Endpoint: `/api/cron/sync?mode=upcoming|live|standings`, cu header `Authorization: Bearer <CRON_SECRET>`.

- `upcoming`: o dată pe zi, aduce programul din ziua precedentă până peste 15 zile — **1 request**.
- `live`: la 15 minute, aduce doar meciurile aflate acum în desfășurare — **1 request**.
- `standings`: o dată pe zi, clasamentul fiecărei competiții urmărite — **8 request-uri**, cu pauză între ele ca să rămână sub limita de 10/minut.

Toate recalculează punctele pronosticurilor. Planul gratuit football-data.org permite 10 request-uri/minut — consumul de mai sus e mult sub limită.

Programarea rulează din GitHub Actions (`.github/workflows/sync.yml`). Adaugă în repo secretele `SITE_URL` și `CRON_SECRET`. Repo-ul public are minute nelimitate; la un repo privat, cele 96 de rulări pe zi pot depăși minutele gratuite, iar alternativa e cron-job.org.

Prima dată, declanșează manual `upcoming`, apoi `standings` (Actions -> Run workflow sau local cu curl) ca să apară meciurile și tabelele.

## Deploy
Vercel (plan gratuit): importă repo-ul și adaugă aceleași variabile de mediu. Pe telefon: "Adaugă pe ecranul principal".

## De făcut mai departe
- Ecran pentru schimbarea numelui afișat (acum e partea din email dinaintea @).
- Joker pe etapă care dublează punctele.
- Notificări "mai ai 1 oră până la meci" (cere service worker).
- Backup periodic al bazei de date.

## Neverificat
Codul a fost scris fără acces la internet pentru a rula sau compila proiectul. Așteaptă-te la mici ajustări la primul `npm run dev`.
