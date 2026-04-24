-- modules-archive.sql
-- Adds soft-archive support and platform-copy locking to the Module System.
--
-- Archive rules (enforced at app layer, not DB):
--   Private/Unlisted + 0 active subscribers → author may hard-delete.
--   Any module with ≥1 active subscriber   → archive only (archived_at set).
--   Thriver                                → may hard-delete anything.
--
-- Platform copy: platform_locked_at is stamped on module_versions rows when
-- a Thriver approves the parent module. The app prevents authors from deleting
-- versions that are locked; Thrivers may delete them via /moderate.

-- ── modules ──────────────────────────────────────────────────────
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS archived_at    timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.modules.archived_at IS
  'Set when the author (or a Thriver) archives the module. Archived modules are
   hidden from the marketplace and block new subscriptions. NULL = live.';

-- ── module_versions ───────────────────────────────────────────────
ALTER TABLE public.module_versions
  ADD COLUMN IF NOT EXISTS platform_locked_at timestamptz;

COMMENT ON COLUMN public.module_versions.platform_locked_at IS
  'Stamped by the platform when the parent module is approved as Listed.
   Locked versions are retained as platform records and cannot be deleted
   by the author, only by a Thriver.';
