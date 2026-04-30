-- Tactical pin markers — link back to the source campaign_pin so
-- "Remove from tactical map" can target only the markers belonging to
-- a specific pin, instead of deleting by name (which can collide when
-- two pins share the same category emoji).
--
-- ON DELETE SET NULL — if the campaign_pin is deleted, the marker
-- stays on the scene so the GM can clean up manually. CASCADE would
-- silently disappear tokens the GM might still want to see.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS campaign_pin_id uuid
    REFERENCES public.campaign_pins(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.scene_tokens.campaign_pin_id IS
  'Source campaign_pin for token_type=pin markers. NULL for any other token type (npc/pc/object).';

CREATE INDEX IF NOT EXISTS scene_tokens_campaign_pin_idx
  ON public.scene_tokens (campaign_pin_id)
  WHERE campaign_pin_id IS NOT NULL;
