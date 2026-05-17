-- hot-table-indexes-2026-05-17.sql
-- Pre-launch audit R11 (tasks/pre-launch-audit-2026-05-17.md).
--
-- High-growth tables (roll_log, chat_messages, notifications) had only
-- their pkey defined. The common access pattern across the app is
-- "newest N for a given scope (campaign / user)", which fell back to
-- sequential scans + sort. At 50k users with active campaigns these
-- queries dominate the live-session page load.
--
-- Adding ordered composite indexes. DESC on created_at because UI loads
-- newest-first (Index Scan Backward avoided). CONCURRENTLY is the right
-- safety pattern for tables that may be hot at apply time, but Supabase
-- migration runners need a transaction so we use plain CREATE INDEX —
-- the tables are not write-heavy enough at current scale for the lock
-- to be a problem (alpha/beta). Re-running with IF NOT EXISTS makes it
-- safe to re-apply.
--
-- Idempotent. Run via:
--   npx supabase db query --linked -f sql/hot-table-indexes-2026-05-17.sql

CREATE INDEX IF NOT EXISTS idx_roll_log_campaign_created
  ON public.roll_log (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_campaign_created
  ON public.chat_messages (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
