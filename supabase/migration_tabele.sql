-- Ruleaza DOAR daca ai rulat deja schema.sql inainte de pagina "Tabele".
create table public.standings (
  league_id int not null,
  season int not null,
  league_name text not null,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (league_id, season)
);
alter table public.standings enable row level security;
create policy "membri vad tabelele" on public.standings
  for select to authenticated using (true);
