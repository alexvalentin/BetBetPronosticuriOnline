# Cinci-Zero: structura site-ului

Site privat, doar pe invitație, de pronosticuri de fotbal între prieteni. Fără bani, doar puncte.
Tot textul din interfață e în română, iar comentariile din cod sunt în engleză.

## 1. Stack

| Componentă | Ce folosim |
|---|---|
| Aplicație | Next.js 15 (App Router) + TypeScript, instalabil pe telefon (PWA) |
| Bază de date și login | Supabase (Postgres, Auth cu cod pe email, RLS) |
| Surse de meciuri | football-data.org (ligi mari, Champions League) și Highlightly (Superliga, Liga 2, Europa League, Conference League, Nations League, cupe naționale) |
| Găzduire | Vercel (Hobby), deploy automat la fiecare push pe `main` |
| Programare sincronizări | Supabase `pg_cron` + `pg_net` (live) și GitHub Actions (zilnic) |

## 2. Pagini

| Adresă | Fișier | Ce face |
|---|---|---|
| `/login` | `src/app/login/page.tsx` | Login în doi pași: email, apoi cod primit pe email |
| `/` (Meciuri) | `src/app/(app)/page.tsx` | Meciurile de azi și mâine, cu formular de pronostic înainte de start și scor live după start. Are căutare după echipă |
| `/rezultate` | `src/app/(app)/rezultate/page.tsx` | Ultimele 60 de meciuri terminate, cu pronosticurile tuturor și punctele luate |
| `/clasamente` | `src/app/(app)/clasamente/page.tsx` | Clasamentele competițiilor (un tab pentru fiecare). Cupele nu au clasament |
| `/punctaj` | `src/app/(app)/punctaj/page.tsx` | Clasamentul prietenilor: puncte, scoruri exacte, rezultate corecte, greșite |
| `/setari` | `src/app/(app)/setari/page.tsx` | Schimbarea numelui afișat și alegerea temei (Automat, Luminos, Întunecat) |

Linkurile vechi `/istoric`, `/tabele` și `/clasament` redirecționează permanent la `/rezultate`, `/clasamente` și `/punctaj` (`next.config.mjs`).

Meniul (ordinea): Meciuri, Rezultate, Clasamente, Punctaj.

## 3. Rute API

| Rută | Cine o apelează | Ce face |
|---|---|---|
| `POST /api/refresh` | Pagina Meciuri (`AutoRefresh`), la 2 minute, doar cât e deschisă și există un meci în desfășurare | Sincronizare live la cerere, doar pentru utilizatori logați |
| `GET /api/cron/sync?mode=...` | `pg_cron` și GitHub Actions | football-data.org. Moduri: `upcoming`, `live`, `standings` |
| `GET /api/cron/sync-highlightly?mode=...` | `pg_cron` și GitHub Actions | Highlightly. Aceleași moduri |

Rutele `/api/cron/*` cer headerul `Authorization: Bearer <CRON_SECRET>`. Parametrul `force=1` sare peste pauza minimă dintre sincronizări (pentru rulări manuale).

## 4. Structura folderelor

```
.
├── .github/workflows/sync.yml     # programare zilnică (program, clasamente) + buclă live de rezervă
├── public/                        # iconițe și manifest PWA
├── supabase/
│   ├── schema.sql                 # schema completă (tabele, politici RLS, funcții, view)
│   └── migration_*.sql            # migrări pentru schemele mai vechi
├── src/
│   ├── middleware.ts              # redirecționează la /login pe cine nu e logat
│   ├── app/
│   │   ├── layout.tsx             # fonturi, metadata, temă setată înainte de afișare
│   │   ├── globals.css            # tot stilul, cu variabile pentru tema luminoasă și întunecată
│   │   ├── actions.ts             # acțiuni server: login, logout, salvare pronostic, schimbare nume
│   │   ├── login/page.tsx
│   │   ├── (app)/                 # paginile din zona logată
│   │   │   ├── layout.tsx         # bara de sus (nume, ieșire din cont, meniu)
│   │   │   ├── page.tsx           # Meciuri
│   │   │   ├── rezultate/ clasamente/ punctaj/ setari/
│   │   └── api/
│   │       ├── refresh/route.ts
│   │       └── cron/{sync,sync-highlightly}/route.ts
│   ├── components/
│   │   ├── MatchCard.tsx          # cardul unui meci (formular sau scor, insigne de status)
│   │   ├── AutoRefresh.tsx        # cere reîmprospătare la 2 minute cât e un meci live
│   │   ├── TeamSearch.tsx         # căutare după echipă, cu sugestii de la 3 litere
│   │   ├── SaveButton.tsx         # butonul de salvare, cu mesajul „Scor actualizat”
│   │   ├── ThemeSetting.tsx       # alegerea temei
│   │   └── Nav.tsx                # meniul
│   └── lib/
│       ├── football.ts            # client football-data.org, lista competițiilor, MATCH_EXCLUDED
│       ├── highlightly.ts         # client Highlightly, ID-urile ligilor și cupelor (LEAGUES, CUP_IDS)
│       ├── cups.ts                # filtrul cupelor: echipe mari sau de la sferturi în sus
│       ├── sync-live.ts           # sincronizarea live, protecția meciurilor terminate, repararea celor blocate
│       ├── standings.ts           # reîmprospătarea clasamentelor (zilnic și după meciuri)
│       ├── format.ts              # date, faza meciului, scorul live, etichete de rundă
│       ├── types.ts               # tipurile Match și Prediction
│       └── supabase/{server,admin}.ts   # clientul cu sesiune (cookie-uri) și clientul admin
```

## 5. Baza de date (Supabase)

| Obiect | Rol |
|---|---|
| `allowed_emails` | Lista de invitați. Un trigger pe `auth.users` refuză orice alt email |
| `profiles` | Un rând pe utilizator, cu numele afișat (creat automat la primul login) |
| `matches` | Meciurile, din ambele surse. Coloane importante: `source`, `status`, `is_finished`, `home_goals` și `away_goals` (completate doar după final), `raw` (răspunsul brut din API, de unde se ia scorul live), `finished_at`, `updated_at`. Id-urile Highlightly sunt negative, ca să nu se suprapună cu cele football-data |
| `predictions` | Pronosticurile (un utilizator are un singur pronostic pe meci), cu `points` completat după final |
| `standings` | Clasamentele competițiilor (JSON), un rând pe competiție și sezon |
| `leaderboard` (view) | Totalurile pe utilizator pentru pagina Punctaj |
| `settle_predictions()` | Funcția care acordă punctele pentru meciurile terminate |

Reguli aplicate direct în baza de date (RLS):
- Pronosticul se poate salva sau modifica doar înainte de startul meciului, după ceasul serverului.
- Pronosticurile celorlalți devin vizibile abia după start.
- Doar utilizatorii logați văd datele.

## 6. Competiții

**football-data.org** (cod): Premier League `PL`, La Liga `PD`, Bundesliga `BL1`, Serie A `SA`, Ligue 1 `FL1`, Champions League `CL`. Au clasament în aplicație și Championship `ELC`, Eredivisie `DED`, Primeira Liga `PPL`, Brasileirão `BSA`, dar fără pronosticuri (`MATCH_EXCLUDED`).

**Highlightly** (id): Superliga `241617`, Liga 2 `242468` (doar clasament), Europa League `3337`, Conference League `722432`, Nations League `5039`.

**Cupe naționale** (Highlightly, fără clasament): Cupa României `243319`, FA Cup `39079`, Copa del Rey `122477`, DFB Pokal `69715`, Coupe de France `56950`, Coppa Italia `117371`.

Filtrul cupelor (`src/lib/cups.ts`), aplicat la salvarea meciurilor: se păstrează un meci doar dacă joacă una dintre echipele mari ale țării respective sau dacă e din fazele de la sferturi în sus. Numele echipelor se normalizează (fără diacritice, fără FC, AC etc.) înainte de comparație. Meciurile care nu trec filtrul nu ajung în baza de date. Europa League și Conference League își păstrează toate meciurile.

## 7. Cum ajung datele pe site

```
football-data.org ─┐                       ┌─ Meciuri
                   ├─► /api/cron/* ─► Supabase ─┼─ Rezultate
Highlightly ───────┘   (sync-live.ts)          ├─ Clasamente
                                               └─ Punctaj
```

| Ce | Când | Cum |
|---|---|---|
| Program (azi și mâine, plus ~27 de zile la football-data) | Zilnic, 00:05 ora României (iarna) | GitHub Actions, `mode=upcoming` |
| Clasamente | Zilnic, 01:10 | GitHub Actions, `mode=standings` |
| Scor live și final | Football-data la 5 minute, Highlightly la 10 minute (verifică intervalul real în Supabase cu `select jobname, schedule from cron.job;`), între 06:00 și 23:55 UTC | `pg_cron` în Supabase (joburile `sync-football-live` și `sync-highlightly-live`) |
| Rezervă pentru live | La vizită, la 2 minute, cât e deschisă pagina Meciuri și există un meci în desfășurare | `/api/refresh` |
| Clasament după un meci | Imediat după final (football-data) și la 10 minute după (ambele) | `refreshDueStandings` din `standings.ts` |
| Reparare meciuri blocate | Zilnic, odată cu programul Highlightly | `catchUpHighlightly`, uită-se 3 zile în urmă |

Sincronizarea live se oprește singură când nu există meci început și nesfârșit în ultimele 6 ore, deci nu consumă cereri degeaba. Pauze minime între două sincronizări ale aceleiași surse: 4 minute la football-data și 9 minute la Highlightly. Meciurile amânate sau anulate sunt ignorate la sincronizarea live, iar un meci deja marcat terminat nu mai poate fi pus înapoi pe „neterminat” (`keepFinished`).

Limite de cereri: football-data are 10 pe minut. Highlightly are 100 pe zi, iar consumul zilnic e aproximativ 40-55 într-o zi obișnuită și până la ~80-95 într-o joi cu Europa League și Conference League simultan.

## 8. Reguli de joc

- Puncte: scor exact 3, rezultat corect (1/X/2) 1, greșit 0. Se ia în calcul scorul după 90 de minute.
- Fazele unui meci pe card (`matchPhase` din `format.ts`): programat, în desfășurare (LIVE), „Se verifică” (au trecut 2h15 și sursa nu a confirmat finalul), terminat (TERMINAT), amânat sau anulat.
- Eticheta rundei de pe card: „Match N” pentru campionate, iar la cupe fazele traduse (Optimi, Sferturi, Semifinale, Finala, Tur 1/32, Calificări și altele).

## 9. Autentificare

Supabase Auth cu cod unic pe email, fără parolă (`signInWithOtp` și `verifyOtp`). `middleware.ts` trimite la `/login` orice utilizator nelogat, cu excepția fișierelor statice și a rutelor `/api/cron`. Accesul e doar pe invitație (`allowed_emails`).

## 10. Variabile de mediu

Fără valori aici. Se setează în Vercel, în GitHub (secretele `SITE_URL` și `CRON_SECRET`) și local în `.env.local`.

| Variabilă | Folosită pentru |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clientul Supabase din browser și server |
| `SUPABASE_SERVICE_ROLE_KEY` | Clientul admin, doar pentru sincronizări |
| `FOOTBALL_DATA_API_KEY` | football-data.org |
| `HIGHLIGHTLY_API_KEY` | Highlightly |
| `CRON_SECRET` | Protejează rutele `/api/cron/*` |

## 11. Limite cunoscute

- Planul gratuit football-data.org uneori actualizează cu întârziere statusul și scorul meciurilor. În acest caz cardul arată „Se verifică” și „Scor indisponibil momentan” până când sursa trimite datele.
- Highlightly are limita de 100 de cereri pe zi. Dacă se epuizează, meciurile din sursa aceasta nu se mai actualizează până a doua zi, apoi sunt reparate de sincronizarea zilnică.
- Schimbarea orei (iarnă și vară) cere ajustarea orelor din `sync.yml`. Joburile `pg_cron` rulează în UTC.

## 12. Servicii și conturi folosite

| Serviciu | La ce îl folosim | Unde găsești cheia sau setarea |
|---|---|---|
| GitHub (repo `BetBetPronosticuriOnline`) | Codul, deploy automat și programarea zilnică (Actions) | Settings, Secrets and variables, Actions: `SITE_URL`, `CRON_SECRET` |
| Vercel | Găzduirea site-ului (`bet-bet-pronosticuri-online.vercel.app`) | Project, Settings, Environment Variables |
| Supabase | Baza de date, login, programarea live (`pg_cron` + `pg_net`) | Project Settings, API (cheile Supabase); SQL Editor pentru joburile `cron` |
| football-data.org | Ligile mari și Champions League | My Account, API Token (`FOOTBALL_DATA_API_KEY`) |
| Highlightly | Superliga, Europa și Conference League, Nations League, cupe | Dashboard, API key (`HIGHLIGHTLY_API_KEY`) |

Valorile cheilor nu se pun niciodată în repo. Ele stau doar în Vercel, în secretele GitHub, în `.env.local` local și în joburile `cron` din Supabase.
