-- Defensive cap on tactical_scenes.cell_px to break the recurring
-- "cell_px reaches 200 mysteriously" playtest bug. The popout's stepper
-- now also caps at 100 client-side, so any DB row above 100 proves a
-- non-popout writer (and the constraint will reject it loudly with an
-- error code, instead of silent corruption).
--
-- 100 is generously wide: typical scenes are 25-50. The lower bound of
-- 5 mirrors the popout's existing min.

ALTER TABLE tactical_scenes
  DROP CONSTRAINT IF EXISTS tactical_scenes_cell_px_range;

ALTER TABLE tactical_scenes
  ADD CONSTRAINT tactical_scenes_cell_px_range
  CHECK (cell_px BETWEEN 5 AND 100);
