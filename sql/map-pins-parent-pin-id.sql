-- map-pins-parent-pin-id.sql
-- Parent/child pin structure on the world map. Lets a "rumor about the
-- basement" hang off a "the abandoned warehouse" pin so dense narrative
-- geography (a haunted town with several specific rooms) can be modeled
-- without flat name-spam on the map.
--
-- Self-FK with ON DELETE SET NULL — deleting a parent doesn't take its
-- children with it, just orphans them back to top-level. The pin
-- browser treats NULL parent_pin_id as a top-level row and indents
-- children one level inside the same category folder.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.map_pins
  ADD COLUMN IF NOT EXISTS parent_pin_id uuid
    REFERENCES public.map_pins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_map_pins_parent
  ON public.map_pins (parent_pin_id);

NOTIFY pgrst, 'reload schema';
