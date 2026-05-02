-- modules-phase-c-reviews.sql
-- Phase 5C ratings + reviews. Lets a subscriber rate a module 1–5 and
-- (optionally) leave a body comment. Aggregates roll up onto the
-- modules row via trigger so the marketplace card can chip avg+count
-- without an extra join. One review per (module, user) — re-submitting
-- updates the existing row.
--
-- RLS shape:
--   SELECT — anyone (public reviews drive social proof)
--   INSERT — auth'd user inserting with their own user_id, AND they
--            have an active module_subscriptions row on the module
--            (no drive-by ratings from non-subscribers)
--   UPDATE — author only, on their own review
--   DELETE — author OR Thriver (moderation surface)
--
-- Aggregate columns on `modules` (avg_rating, rating_count) are
-- maintained by AFTER INSERT/UPDATE/DELETE trigger so the marketplace
-- card and dashboard featured surface can read them cheaply.
--
-- Idempotent — safe to re-run.

-- ── Aggregate columns on modules ────────────────────────────────────
ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS avg_rating   numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer      DEFAULT 0;

-- ── Reviews table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.module_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_module_reviews_module
  ON public.module_reviews (module_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_module_reviews_user
  ON public.module_reviews (user_id);

ALTER TABLE public.module_reviews ENABLE ROW LEVEL SECURITY;

-- ── RLS ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS module_reviews_select ON public.module_reviews;
CREATE POLICY module_reviews_select ON public.module_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS module_reviews_insert ON public.module_reviews;
CREATE POLICY module_reviews_insert ON public.module_reviews
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM public.module_subscriptions ms
        JOIN public.campaigns c ON c.id = ms.campaign_id
       WHERE ms.module_id = module_reviews.module_id
         AND ms.status     = 'active'
         AND c.gm_user_id  = auth.uid()
    )
  );

DROP POLICY IF EXISTS module_reviews_update ON public.module_reviews;
CREATE POLICY module_reviews_update ON public.module_reviews
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS module_reviews_delete ON public.module_reviews;
CREATE POLICY module_reviews_delete ON public.module_reviews
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'thriver')
  );

-- ── Aggregate maintenance trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.module_reviews_recompute_aggregate()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_id uuid := COALESCE(NEW.module_id, OLD.module_id);
  agg RECORD;
BEGIN
  SELECT
    COALESCE(AVG(rating)::numeric(3,2), 0) AS avg_r,
    COUNT(*)::int                          AS cnt
  INTO agg
  FROM public.module_reviews
  WHERE module_id = target_id;

  UPDATE public.modules
     SET avg_rating   = agg.avg_r,
         rating_count = agg.cnt
   WHERE id = target_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_module_reviews_aggregate ON public.module_reviews;
CREATE TRIGGER trg_module_reviews_aggregate
AFTER INSERT OR UPDATE OR DELETE ON public.module_reviews
FOR EACH ROW EXECUTE FUNCTION public.module_reviews_recompute_aggregate();

-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.module_reviews_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_module_reviews_touch ON public.module_reviews;
CREATE TRIGGER trg_module_reviews_touch
BEFORE UPDATE ON public.module_reviews
FOR EACH ROW EXECUTE FUNCTION public.module_reviews_touch_updated_at();

-- Backfill aggregates (no-op on first run; safe re-run after manual edits)
UPDATE public.modules m
   SET avg_rating   = COALESCE(s.avg_r, 0),
       rating_count = COALESCE(s.cnt,   0)
  FROM (
    SELECT module_id,
           AVG(rating)::numeric(3,2) AS avg_r,
           COUNT(*)::int             AS cnt
      FROM public.module_reviews
     GROUP BY module_id
  ) s
 WHERE m.id = s.module_id;

NOTIFY pgrst, 'reload schema';
