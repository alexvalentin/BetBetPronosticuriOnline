-- Ruleaza tot fisierul in Supabase -> SQL Editor.

-- =========================================================
-- 1. Invitatii: doar emailurile din lista pot crea cont
-- =========================================================
create table public.allowed_emails (email text primary key);
alter table public.allowed_emails enable row level security; -- fara policy = inaccesibil din API

-- Adauga prietenii (si pe tine) aici:
-- insert into public.allowed_emails (email) values ('tu@exemplu.ro'), ('prieten@exemplu.ro');

create or replace function public.enforce_allowed_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.allowed_emails where lower(email) = lower(new.email)) then
    raise exception 'Email neinvitat';
  end if;
  return new;
end $$;

create trigger before_user_created
  before insert on auth.users
  for each row execute function public.enforce_allowed_email();

-- =========================================================
-- 2. Tabele
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.matches (
  id bigint primary key,                 -- id-ul meciului de la football-data.org
  league_id text not null,              -- codul competitiei la football-data.org, ex: 'PL'
  league_name text not null,
  round text,
  season int,
  home_team text not null,
  away_team text not null,
  home_logo text,
  away_logo text,
  kickoff_at timestamptz not null,
  status text not null default 'NS',
  is_finished boolean not null default false,
  home_goals int,                        -- scorul dupa 90 de minute
  away_goals int,
  raw jsonb,                             -- raspunsul brut din API, pentru depanare
  updated_at timestamptz not null default now()
);
create index matches_kickoff_idx on public.matches (kickoff_at);
create index matches_finished_idx on public.matches (is_finished, kickoff_at);

create table public.predictions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id bigint not null references public.matches(id),
  home_goals int not null check (home_goals between 0 and 20),
  away_goals int not null check (away_goals between 0 and 20),
  points int,                            -- null pana se termina meciul
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);
create index predictions_match_idx on public.predictions (match_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- updated_at se schimba doar cand utilizatorul isi modifica pronosticul, nu la calculul punctelor
create trigger predictions_updated_at
  before update of home_goals, away_goals on public.predictions
  for each row execute function public.set_updated_at();

-- =========================================================
-- 3. Securitate (RLS)
-- =========================================================
alter table public.profiles enable row level security;
create policy "membri vad profilurile" on public.profiles
  for select to authenticated using (true);
create policy "iti editezi propriul profil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

alter table public.matches enable row level security;
create policy "membri vad meciurile" on public.matches
  for select to authenticated using (true);
-- matches se scrie doar din server, cu service role

alter table public.predictions enable row level security;

-- Pronosticurile celorlalti devin vizibile doar dupa startul meciului
create policy "vezi pronosticul propriu sau dupa start" on public.predictions
  for select to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.matches m where m.id = match_id and m.kickoff_at <= now())
  );

-- Blocarea la ora de start se aplica aici, in baza de date, pe ceasul serverului
create policy "pronostic nou doar inainte de start" on public.predictions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.matches m
                where m.id = match_id and m.kickoff_at > now() and not m.is_finished)
  );

create policy "modifici pronosticul doar inainte de start" on public.predictions
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.matches m
                where m.id = match_id and m.kickoff_at > now() and not m.is_finished)
  )
  with check (user_id = auth.uid());

-- Utilizatorii nu pot scrie singuri punctele
revoke insert, update on public.predictions from authenticated;
grant insert (user_id, match_id, home_goals, away_goals) on public.predictions to authenticated;
grant update (home_goals, away_goals) on public.predictions to authenticated;

-- =========================================================
-- 4. Punctarea (sursa unica de adevar)
--    scor exact = 3, rezultat corect (1/X/2) = 1, gresit = 0
--    Se recalculeaza la fiecare sincronizare, deci corectiile din API se propaga.
-- =========================================================
create or replace function public.settle_predictions()
returns void language plpgsql as $$
begin
  update public.predictions p
     set points = case
       when p.home_goals = m.home_goals and p.away_goals = m.away_goals then 3
       when sign(p.home_goals - p.away_goals) = sign(m.home_goals - m.away_goals) then 1
       else 0 end
    from public.matches m
   where m.id = p.match_id
     and m.is_finished
     and m.home_goals is not null and m.away_goals is not null;

  update public.predictions p
     set points = null
    from public.matches m
   where m.id = p.match_id and not m.is_finished and p.points is not null;
end $$;

revoke execute on function public.settle_predictions() from public, anon, authenticated;

-- =========================================================
-- 5. Clasament
-- =========================================================
create view public.leaderboard as
select
  p.id as user_id,
  p.display_name,
  coalesce(sum(pr.points), 0)::int as total_points,
  count(*) filter (where pr.points = 3)::int as exact_scores,
  count(*) filter (where pr.points = 1)::int as correct_results,
  count(*) filter (where pr.points = 0)::int as wrong,
  count(*) filter (where pr.points is not null)::int as settled
from public.profiles p
left join public.predictions pr on pr.user_id = p.id
group by p.id, p.display_name;

revoke all on public.leaderboard from anon;
grant select on public.leaderboard to authenticated;

-- =========================================================
-- 6. Tabele (clasamentele competitiilor de la football-data.org)
-- =========================================================
create table public.standings (
  league_id text not null,              -- codul competitiei, ex: 'PL'
  season int not null,
  league_name text not null,
  data jsonb not null default '[]'::jsonb,   -- lista de grupe, fiecare cu randurile ei
  updated_at timestamptz not null default now(),
  primary key (league_id, season)
);
alter table public.standings enable row level security;
create policy "membri vad tabelele" on public.standings
  for select to authenticated using (true);
