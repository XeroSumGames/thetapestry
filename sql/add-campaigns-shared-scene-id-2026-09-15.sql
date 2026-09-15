-- Persist the tactical scene the GM last Shared, so a player who loads or
-- refreshes the table lands on THAT scene instead of whatever scene is_active
-- (the GM may be prepping a different scene privately). Until now the shared
-- scene lived only in a `tactical_shared` broadcast, so a fresh player tab had
-- nothing to hydrate from. Xero said "go" 2026-09-14 (COMMS Q3): keep the
-- private-prep stickiness, add a non-GM banner, hydrate the shared scene on load.
--
-- campaigns uses COLUMN-level SELECT grants (invite_code is withheld, see
-- sec-pii-revoke-campaigns-invite-code-2026-06-29.sql), so a new column is
-- unreadable by clients until it gets its own grant. Table-level UPDATE is
-- already granted to authenticated; the "GM can update campaigns" policy keeps
-- writes GM-only.
--
-- ORDER: apply this BEFORE deploying the app change that selects
-- shared_scene_id (lib/data/campaigns.ts CAMPAIGN_COLUMNS), or the table page's
-- campaign load 400s on the unknown column.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS shared_scene_id uuid NULL
  REFERENCES public.tactical_scenes(id) ON DELETE SET NULL;

GRANT SELECT (shared_scene_id) ON public.campaigns TO authenticated;

NOTIFY pgrst, 'reload schema';
