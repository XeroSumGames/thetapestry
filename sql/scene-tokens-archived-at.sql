-- scene-tokens-archived-at.sql
-- Adds soft-delete to scene_tokens so unmap/remap preserves token
-- position across the cycle. Without this, the GM unmapping a folder
-- DELETEs the rows; re-mapping inserts fresh at the top-left cluster
-- and the GM has to re-place every token by hand.
--
-- archived_at IS NULL  → token is on the map
-- archived_at NOT NULL → token is "unmapped" (invisible to everyone,
--                       position preserved for the next remap)
--
-- Idempotent. Existing rows default to NULL (still on the map), so this
-- migration is non-destructive.

ALTER TABLE public.scene_tokens
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_scene_tokens_archived_at
  ON public.scene_tokens (scene_id)
  WHERE archived_at IS NULL;
