-- ============================================================
-- Tighten initiative_order RLS (2026-05-11)
--
-- Background: after sql/initiative-order-rls-members-write.sql (commit
-- 0fde192) added per-campaign SELECT/INSERT/UPDATE/DELETE policies,
-- verification surfaced legacy policies that pre-dated the migration:
--
--   "Anyone authenticated can manage initiative" (cmd ALL)
--     Lets ANY authenticated user INSERT/UPDATE/DELETE on ANY
--     campaign's initiative_order rows. This is the legacy hack
--     that masked the original silent-write bug. Drop it.
--
--   "Campaign members can read initiative" (cmd SELECT)
--   "Campaign members can view initiative"  (cmd SELECT)
--     Duplicates of the new "Campaign members read initiative"
--     added in 0fde192. Drop both.
--
--   "initiative_order_thriver_bypass" (cmd ALL) - KEPT (moderation).
--
-- Every runtime writer (consumeAction, nextTurn, deferInitiative,
-- Start Combat, Cover Fire, Inspire, Distract, restoreSnapshot,
-- NPC delete) runs from a member or GM client, so the legacy
-- "anyone authenticated" policy is not load-bearing.
--
-- Idempotent. Run in Supabase SQL Editor or:
--   npx supabase db query --linked -f sql/initiative-order-rls-tighten-2026-05.sql
-- ============================================================

DROP POLICY IF EXISTS "Anyone authenticated can manage initiative" ON public.initiative_order;
DROP POLICY IF EXISTS "Campaign members can read initiative"       ON public.initiative_order;
DROP POLICY IF EXISTS "Campaign members can view initiative"       ON public.initiative_order;

NOTIFY pgrst, 'reload schema';
