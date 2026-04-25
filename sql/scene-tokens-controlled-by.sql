-- scene-tokens-controlled-by.sql
-- Adds an opt-in player-control list to scene_tokens. By default
-- only the GM can move object/NPC tokens; this column lets the GM
-- whitelist specific player characters to drag a particular token
-- (e.g. the player driving Minnie can move the Minnie token even
-- though it's an "object" token, not a PC token).
--
-- Empty array (the default) preserves the original behavior: GM-only.
-- Idempotent.

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS controlled_by_character_ids uuid[] NOT NULL DEFAULT '{}';
