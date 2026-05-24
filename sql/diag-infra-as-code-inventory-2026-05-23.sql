-- Read-only inventory for Stage A1 infra-as-code scoping (2026-05-23).
-- Counts + lists of the config that lives only in the live DB today.
select '1. public tables (total)' as metric, count(*)::text as val
  from pg_tables where schemaname='public'
union all
select '2. tables with RLS ENABLED', count(*)::text
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity
union all
select '3. tables with RLS DISABLED (gap risk)', count(*)::text
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
union all
select '4. RLS policies (total)', count(*)::text from pg_policies where schemaname='public'
union all
select '5. triggers on public tables', count(*)::text
  from information_schema.triggers where trigger_schema='public'
union all
select '6. tables in supabase_realtime publication', count(*)::text
  from pg_publication_tables where pubname='supabase_realtime'
union all
select '7. functions in public (RPCs etc)', count(*)::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';
