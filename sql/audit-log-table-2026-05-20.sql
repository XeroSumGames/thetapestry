-- audit-log-table-2026-05-20.sql
-- Spec: tasks/spec-audit-log-destructive-ops.md Phase AL1.
-- Closes Phase P3 / A4.3 of tasks/puffer-fish-platform-plan.md.
--
-- Creates the append-only `audit_log` table that captures destructive
-- operations (DELETE / BULK_DELETE / CRITICAL_UPDATE / CASCADE_DELETE)
-- for single-row recovery + forensic investigation. Replaces the
-- recovery story for Scenarios A/B/C in the backup playbook while
-- Supabase Pro + PITR is deferred per launch-plan-2026-06-15.md.
--
-- Phase AL1 ONLY creates the table + indexes + RLS. No triggers fire
-- yet (Phase AL2 wires the high-stakes tables; AL3 covers the rest;
-- AL4 wires edge-function + bulk-op writes).
--
-- Idempotent. Run via:
--   npx supabase db query --linked -f sql/audit-log-table-2026-05-20.sql

CREATE TABLE IF NOT EXISTS public.audit_log (
  id                  bigserial PRIMARY KEY,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  actor_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role          text,           -- 'thriver' | 'survivor' | 'ghost' | 'system' snapshot at write time
  campaign_id         uuid,           -- nullable for non-campaign-scoped ops
  table_name          text NOT NULL,
  row_id              text NOT NULL,  -- text not uuid: some tables use composite keys
  operation           text NOT NULL CHECK (operation IN ('DELETE', 'BULK_DELETE', 'CRITICAL_UPDATE', 'CASCADE_DELETE')),
  before_state        jsonb,          -- pre-op row state for recovery; NULL if not captured
  after_state         jsonb,          -- post-op row state for CRITICAL_UPDATE; NULL for DELETE
  reason              text,           -- optional GM-supplied or system-supplied context
  client_ip           text,           -- captured from x-forwarded-for at write time
  user_agent          text,
  recovery_attempted  boolean NOT NULL DEFAULT false,
  recovered_at        timestamptz
);

-- ── Indexes ──────────────────────────────────────────────────────
-- occurred_at DESC is the primary forensic query axis ("what happened
-- recently"). The other three are filtered indexes for common
-- recovery / investigation queries.
CREATE INDEX IF NOT EXISTS idx_audit_log_occurred_at
  ON public.audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id
  ON public.audit_log (actor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_campaign_id
  ON public.audit_log (campaign_id, occurred_at DESC)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_table_row
  ON public.audit_log (table_name, row_id, occurred_at DESC);

-- ── Row Level Security ───────────────────────────────────────────
-- Thrivers read everything (for moderation / recovery work).
-- Self read for any user (transparency: "what did I do that's
-- recorded here?").
-- No INSERT / UPDATE / DELETE policies = client writes are blocked.
-- All writes go through SECURITY DEFINER trigger functions (Phase
-- AL2+) or the service-role-key edge functions (Phase AL4).
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- DROP-then-CREATE for the policies because Postgres pre-15 doesn't
-- support `CREATE POLICY IF NOT EXISTS`. Idempotent re-apply.
DROP POLICY IF EXISTS "audit_log_thriver_read" ON public.audit_log;
CREATE POLICY "audit_log_thriver_read" ON public.audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND lower(role) = 'thriver'
    )
  );

DROP POLICY IF EXISTS "audit_log_self_read" ON public.audit_log;
CREATE POLICY "audit_log_self_read" ON public.audit_log
  FOR SELECT
  USING (actor_user_id = auth.uid());

-- ── Reload PostgREST schema so the new table is queryable via the
--    REST API immediately. Without this, the first client query
--    returns 404 until the next scheduled reload (typically minutes).
NOTIFY pgrst, 'reload schema';
