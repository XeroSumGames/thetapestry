-- tactical-scenes-walls.sql
-- Wall/door/window segments living on cell edges (Foundry-style).
-- Object-based walls/doors/windows from the earlier vision sprint
-- still work, but they occupied a whole cell, which made buildings
-- look 5ft thick. These segments live BETWEEN cells (drawn on cell
-- intersections) so a wall is visually thin and the cells on either
-- side are fully usable for token placement.
--
-- Shape:
--   { id, x1, y1, x2, y2, kind: 'wall'|'door'|'window', door_open: bool }
--
-- Coordinates are integer cell intersections — (0,0) is the top-left
-- corner of cell A1, (cols, 0) is the top-right corner of the
-- rightmost cell in row 0, etc. Segments are typically axis-aligned
-- (horizontal or vertical) but the data model accepts diagonals so
-- a future "draw any line" tool can render them without schema
-- changes.
--
-- Movement blockers: walls, closed doors, windows.
-- Vision blockers: walls, closed doors. (Windows pass.)
-- Open doors block neither.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.tactical_scenes
  ADD COLUMN IF NOT EXISTS walls jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
