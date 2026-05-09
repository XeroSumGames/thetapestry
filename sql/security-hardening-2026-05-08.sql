-- Security hardening — 2026-05-08
--
-- Clears Tier 1 + Tier 2 of the Supabase Database Linter warnings:
--
--   Tier 1 — high-impact, real risk:
--     1.1  Lock down admin_user_with_login + admin_users_with_login so
--          anon can't call them at all (they already check is_thriver
--          inside, but defense-in-depth: revoke anon EXECUTE outright).
--     1.2  Replace the 3 always-true RLS policies that were silently
--          flat-bypassing RLS:
--            - session_attachments ALL (using=true, with_check=true)
--            - sessions INSERT (with_check=true)
--            - sessions UPDATE (using=true, with_check=true)
--          The session policies are replaced with GM-scoped versions
--          (matching sessions-rls-fix.sql's "GMs can update/delete"
--          pattern). session_attachments gets a per-uploader write
--          gate + authenticated-read.
--
--   Tier 2 — defense in depth, mechanical fixes:
--     2.1  Add SET search_path = public, pg_catalog to every public
--          function that doesn't already have one set. Closes the
--          mutable-search-path vector on SECURITY DEFINER functions.
--     2.2  Revoke EXECUTE FROM PUBLIC, anon on every trigger function
--          in the public schema. Trigger functions don't need RPC
--          access — triggers fire from DB events, not API calls.
--          Cuts ~30 anon-callable warnings from the linter.
--
-- Apply via Supabase SQL Editor (paste contents and Run) OR
--   `npx supabase db query --linked -f sql/security-hardening-2026-05-08.sql`
--
-- Idempotent — every block uses CREATE OR REPLACE / DROP IF EXISTS /
-- conditional checks so re-running is safe.

-- ─────────────────────────────────────────────────────────────────────
-- Tier 1.1 — Admin function exposure
-- ─────────────────────────────────────────────────────────────────────

-- Belt: revoke from PUBLIC (Postgres' default-grant target) AND anon
-- explicitly. Suspenders: GRANT TO authenticated still in admin-users-
-- with-login.sql, so signed-in callers (gated internally on Thriver)
-- still work. Anonymous visitors hit a permission-denied error before
-- the function body even runs.
revoke execute on function public.admin_users_with_login() from public, anon;
revoke execute on function public.admin_user_with_login(uuid) from public, anon;

-- ─────────────────────────────────────────────────────────────────────
-- Tier 1.2 — Replace always-true RLS policies
-- ─────────────────────────────────────────────────────────────────────

-- sessions INSERT — was "GM can insert sessions" with WITH CHECK (true).
-- Replace with GM-of-the-campaign scoped policy.
drop policy if exists "GM can insert sessions" on public.sessions;
drop policy if exists sessions_insert_gm on public.sessions;
create policy sessions_insert_gm on public.sessions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.campaigns c
      where c.id = sessions.campaign_id and c.gm_user_id = auth.uid()
    )
  );

-- sessions UPDATE — was "GM can update sessions" with USING (true).
-- "GMs can update sessions" (proper variant) already exists per
-- sessions-rls-fix.sql; we just need to drop the broken one. Recreating
-- the correct one anyway in case sessions-rls-fix.sql wasn't applied
-- in this env.
drop policy if exists "GM can update sessions" on public.sessions;
drop policy if exists "GMs can update sessions" on public.sessions;
create policy "GMs can update sessions" on public.sessions
  for update to authenticated
  using (
    exists (
      select 1 from public.campaigns c
      where c.id = sessions.campaign_id and c.gm_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.campaigns c
      where c.id = sessions.campaign_id and c.gm_user_id = auth.uid()
    )
  );

-- session_attachments ALL — was "Authenticated users can manage session
-- attachments" with using/with-check both = true (anyone authenticated
-- could read/write/delete any session attachment regardless of
-- campaign membership). Replace with split per-operation policies:
--   - SELECT: any authenticated user can read (matches existing pattern
--     for community-contributed content; tighten later if needed)
--   - INSERT/UPDATE/DELETE: only the original uploader.
--
-- This is intentionally CONSERVATIVE — it locks writes to the uploader
-- only. Campaign GMs lose the ability to delete other members'
-- attachments through this policy. If that becomes a problem, add a
-- separate GM-bypass policy (`exists (select 1 from sessions s join
-- campaigns c on c.id = s.campaign_id where s.id = ... and
-- c.gm_user_id = auth.uid())`). Doing the conservative fix first to
-- close the security hole; widening is reversible.
drop policy if exists "Authenticated users can manage session attachments" on public.session_attachments;
drop policy if exists session_attachments_select on public.session_attachments;
drop policy if exists session_attachments_insert on public.session_attachments;
drop policy if exists session_attachments_update on public.session_attachments;
drop policy if exists session_attachments_delete on public.session_attachments;

create policy session_attachments_select on public.session_attachments
  for select to authenticated using (true);

create policy session_attachments_insert on public.session_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid());

create policy session_attachments_update on public.session_attachments
  for update to authenticated
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());

create policy session_attachments_delete on public.session_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────
-- Tier 2.1 — Force SET search_path on every public function that
-- doesn't already have one. Idempotent: skips functions whose
-- proconfig already includes a search_path setting.
-- ─────────────────────────────────────────────────────────────────────

do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as func_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c
        where c like 'search_path=%'
      )
  loop
    execute format('alter function %I.%I(%s) set search_path = public, pg_catalog',
                   fn.schema_name, fn.func_name, fn.args);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- Tier 2.2 — Revoke EXECUTE FROM PUBLIC, anon on every trigger function.
-- Trigger functions return type 'trigger' and fire on DB events; they
-- don't need to be exposed via PostgREST RPC. Removing anon access
-- doesn't affect the triggers themselves (those run as the trigger
-- owner regardless of caller permissions).
-- ─────────────────────────────────────────────────────────────────────

do $$
declare
  fn record;
begin
  for fn in
    select n.nspname as schema_name,
           p.proname as func_name,
           pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %I.%I(%s) from public, anon, authenticated',
                   fn.schema_name, fn.func_name, fn.args);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- Schema reload so PostgREST sees the new policies + permissions
-- without waiting for the periodic refresh.
-- ─────────────────────────────────────────────────────────────────────

notify pgrst, 'reload schema';
