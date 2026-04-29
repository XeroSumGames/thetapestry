-- debug_log — client-side telemetry for triaging perf / failures
-- without screenshots.
--
-- Captures (this version):
--   - Manual dlog.info / warn / error / perf calls from app code
--   - window.onerror + unhandledrejection (auto)
--   - Page-navigation timing (TTFB / DOMContentLoaded / loadEvent) auto on mount
--
-- Notable absence: NO global window.fetch wrapper this time. Earlier
-- attempt wrapped fetch to auto-capture 5xx + slow requests, but global
-- fetch interception is invasive and a subtle bug there breaks every
-- request in the app. The manual + error-handler subset captures most
-- of what we actually need (errors are loud; perf can be measured at
-- specific call sites with dlog.perf).
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
  event text not null,                    -- short event name e.g. 'page_load', 'mount_wave2'
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

-- ── TRIAGE QUERIES ──
--
-- Last 1 hour, all errors + warnings:
--   select created_at, level, event, payload, url, client_id
--   from debug_log
--   where created_at > now() - interval '1 hour'
--     and level in ('warn', 'error')
--   order by created_at desc
--   limit 200;
--
-- Specific user, last hour:
--   select created_at, level, event, payload, url
--   from debug_log
--   where user_id = (select id from auth.users where email = 'xerosumgames@gmail.com')
--     and created_at > now() - interval '1 hour'
--   order by created_at desc
--   limit 200;
--
-- Page-load timing per route (p50 / p90):
--   select url, count(*) as n,
--          round(percentile_cont(0.5) within group (order by (payload->>'ms')::int)::numeric, 0) as p50_ms,
--          round(percentile_cont(0.9) within group (order by (payload->>'ms')::int)::numeric, 0) as p90_ms,
--          round(avg((payload->>'ttfb')::int)) as avg_ttfb
--   from debug_log
--   where event = 'page_load' and created_at > now() - interval '24 hours'
--   group by url
--   order by p50_ms desc;
--
-- One client's stream (pick a client_id from the above):
--   select created_at, level, event, payload, url
--   from debug_log
--   where client_id = '<paste-client-id>'
--   order by created_at;
--
-- Cleanup (delete rows older than 7 days):
--   delete from debug_log where created_at < now() - interval '7 days';
