-- ============================================================
-- campaign_npcs: add `disposition` column (friendly/neutral/hostile)
-- ============================================================
--
-- Ring color on the NPC portrait circle is semantically about how
-- the NPC feels toward the PCs — friendly / neutral / hostile —
-- NOT about their npc_type (Bystander/Goon/Foe/Antagonist, which
-- is more about role/threat-level). Tracking it as its own column
-- keeps the two concerns independent: a Goon can be a friendly ally
-- who's helping out, or a Bystander can be hostile if the party
-- wronged them.
--
-- Nullable — existing NPCs without a disposition default to neutral
-- in the UI. GM can set per-NPC via a ring-color picker on the
-- Edit NPC form.
--
-- Idempotent.

ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS disposition text;

-- CHECK constraint — same idempotent DROP+ADD pattern as the role
-- constraint in community_members so re-running the migration is
-- safe.
ALTER TABLE public.campaign_npcs
  DROP CONSTRAINT IF EXISTS campaign_npcs_disposition_check;

ALTER TABLE public.campaign_npcs
  ADD CONSTRAINT campaign_npcs_disposition_check
  CHECK (disposition IS NULL OR disposition IN ('friendly','neutral','hostile'));

-- ── Diagnostic ──
-- SELECT name, disposition, npc_type FROM public.campaign_npcs ORDER BY name;
