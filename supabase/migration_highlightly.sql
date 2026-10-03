-- Ruleaza o singura data, in Supabase SQL Editor.
-- Adauga sursa fiecarui meci (ca sa deosebim football-data.org de Highlightly) si confirma
-- ca id-ul Highlightly, stocat negativ in cod, nu se suprapune peste cele existente (pozitive).
alter table public.matches add column if not exists source text not null default 'football-data';
