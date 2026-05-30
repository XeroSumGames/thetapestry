-- Raise tactical_scenes.cell_px cap from 100 to 300. High-DPI maps
-- (4800x6600 designed for a 16x22 grid) need cellPx=300 for the
-- gridToCoverMap auto-fit to match the image's intended cell count.

ALTER TABLE tactical_scenes
  DROP CONSTRAINT IF EXISTS tactical_scenes_cell_px_range;

ALTER TABLE tactical_scenes
  ADD CONSTRAINT tactical_scenes_cell_px_range
  CHECK (cell_px BETWEEN 5 AND 300);
