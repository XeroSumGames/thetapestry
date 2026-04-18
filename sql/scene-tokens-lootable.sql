-- Add `lootable` flag to scene_tokens so the GM can unlock an intact crate
-- (or locker, barrel, vehicle, etc.) for player looting without having to
-- destroy it first. Players can Take items when `lootable = true` OR the
-- object is destroyed (wp_current <= 0 with wp_max > 0).
ALTER TABLE public.scene_tokens ADD COLUMN IF NOT EXISTS lootable boolean NOT NULL DEFAULT false;
