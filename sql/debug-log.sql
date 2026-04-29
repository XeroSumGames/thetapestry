-- debug_log — client-side logging surface for debugging perf / failures.
--
-- Captures:
--   - Browser fetch 5xx + slow (>5s) + throw
--   - window.onerror + unhandledrejection
--   - Manual dlog.info/warn/error/perf calls from app code
--   - Page-navigation timing (domContentLoaded, loadEvent, TTFB)
--
-- Designed for triage during multi-browser playtests where the user can't
-- realistically capture HAR / console for 5 browsers at once. Thrivers
-- read the table to debug; users can also read their own rows.
--
-- TTL: not enforced at DB level. Manual cleanup recipe at bottom.
--
-- Apply once via Supabase SQL editor:
--   psql or paste into Studio → SQL → run.

create table if not exists public.debug_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  client_id text,                         -- per-tab UUID, lets you correlate one browser's stream
  level text not null check (level in ('info', 'warn', 'error', 'perf')),
  event text not null,                    -- short event name e.g. 'fetch_5xx', 'mount_wave2', 'page_load'
  payload jsonb,                          -- structured detail; depends on event
  url text,                               -- pathname + query (apikey stripped)
  user_agent text,                        -- truncated UA string
  created_at timestamptz not null default now()
);

create index if not exists debug_log_created_at_idx on public.debug_log (created_at desc);
create index if not exists debug_log_user_id_idx on public.debug_log (user_id);
create index if not exists debug_log_campaign_id_idx on public.debug_log (campaign_id);
create index if not exists debug_log_level_idx on public.debug_log (level) where level in ('warn', 'error');
create index if not exists debug_log_event_idx on public.debug_log (event);

alter table public.debug_log enable row level security;

-- INSERT: any authenticated user can write their own (or anonymous-tagged) rows
drop policy if exists "debug_log_insert" on public.debug_log;
create policy "debug_log_insert"
  on public.debug_log for insert
  to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- SELECT: users see their own rows; thrivers see all
drop policy if exists "debug_log_select_own" on public.debug_log;
create policy "debug_log_select_own"
  on public.debug_log for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "debug_log_select_thriver" on public.debug_log;
create policy "debug_log_select_thriver"
  on public.debug_log for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'Thriver'
    )
  );

-- DELETE: thriver only (manual cleanup)
drop policy if exists "debug_log_delete_thriver" on public.debug_log;
create policy "debug_log_delete_thriver"
  on public.debug_log for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'Thriver'
    )
  );

-- ── USAGE ──
-- Triage queries (run in Supabase Studio / psql):
--
-- Last 1 hour, all errors + warnings:
--   select created_at, level, event, payload, url, client_id
--   from debug_log
--   where created_at > now() - interval '1 hour'
--     and level in ('warn', 'error')
--   order by created_at desc
--   limit 200;
--
-- Slow fetches by URL:
--   select payload->>'url' as url, count(*) as n,
--          avg((payload->>'duration_ms')::int) as avg_ms,
--          max((payload->>'duration_ms')::int) as max_ms
--   from debug_log
--   where event in ('fetch_slow', 'fetch_5xx')
--     and created_at > now() - interval '24 hours'
--   group by 1
--   order by n desc;
--
-- Page-load timing distribution per route:
--   select url, percentile_cont(0.5) within group (order by (payload->>'ms')::int) as p50_ms,
--               percentile_cont(0.9) within group (order by (payload->>'ms')::int) as p90_ms,
--               count(*) as n
--   from debug_log
--   where event = 'page_load' and created_at > now() - interval '24 hours'
--   group by url
--   order by p50_ms desc;
--
-- One client's recent stream (use a client_id from another query):
--   select created_at, level, event, payload, url
--   from debug_log
--   where client_id = '<paste-client-id>'
--   order by created_at desc
--   limit 100;
--
-- Cleanup (delete rows older than 7 days):
--   delete from debug_log where created_at < now() - interval '7 days';
