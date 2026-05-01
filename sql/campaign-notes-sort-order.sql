-- campaign-notes-sort-order.sql
-- Adds explicit sort_order to campaign_notes so the GM can drag-to-
-- rearrange notes inside the GM Notes panel. Previously notes always
-- sorted by created_at ASC, leaving no way to promote an important
-- note to the top once the session was underway.
--
-- Existing rows are backfilled to their current created_at order so
-- the visible order doesn't shift when this ships. New inserts can
-- omit sort_order (NULL) and will sort to the end via the
-- 'sort_order ASC NULLS LAST, created_at ASC' clause in the client.
--
-- Idempotent — safe to re-run.

ALTER TABLE public.campaign_notes
  ADD COLUMN IF NOT EXISTS sort_order integer;

-- Backfill: per campaign, assign sort_order = row_number() over the
-- existing created_at order. Only writes rows where sort_order IS
-- NULL so re-runs don't clobber later reorders.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY created_at ASC) AS rn
  FROM public.campaign_notes
  WHERE sort_order IS NULL
)
UPDATE public.campaign_notes cn
SET sort_order = numbered.rn
FROM numbered
WHERE cn.id = numbered.id;

CREATE INDEX IF NOT EXISTS idx_campaign_notes_sort_order
  ON public.campaign_notes (campaign_id, sort_order);

NOTIFY pgrst, 'reload schema';
