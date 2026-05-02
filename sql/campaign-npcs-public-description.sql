-- campaign-npcs-public-description.sql
-- Player-visible NPC description, distinct from the GM-private notes
-- field. notes was the historical catch-all; the seed importers
-- concatenate role + description + how_to_meet into it, so it carries
-- spoilers and bookkeeping the GM doesn't want auto-revealed when an
-- NPC is shown to players.
--
-- public_description is the GM's authored "what players see" blurb.
-- Surfaces in PlayerNpcCard whenever set; existing NPCs render no
-- public-description block until the GM writes one (graceful empty).
--
-- Idempotent — safe to re-run.

ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS public_description text;

NOTIFY pgrst, 'reload schema';
