-- Ruleaza DOAR daca ai rulat deja schema.sql (sau migration_tabele.sql) INAINTE de trecerea la football-data.org.
-- Codul competitiei e acum text (ex: "PL"), nu numar, pentru ca football-data.org foloseste coduri alfabetice.
alter table public.matches alter column league_id type text using league_id::text;
alter table public.standings alter column league_id type text using league_id::text;
