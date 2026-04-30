-- Phase 5 Sprint 4 — surface subscriber count on the marketplace.
--
-- Adds a denormalized `subscriber_count` column on `modules` (NOT on
-- module_versions — the marketplace card is per-module, and a module
-- with five versions still represents one logical "downloads" total).
-- Maintained by a trigger on `module_subscriptions` so the column is
-- always current without app-side bookkeeping.
--
-- Counts only ACTIVE subscriptions (status='active'). Cancelled /
-- archived subscriptions don't inflate the public count.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS subscriber_count int NOT NULL DEFAULT 0;

-- Trigger function — recalculates the count for whichever module(s)
-- the firing row touches. Runs on every INSERT / DELETE / UPDATE so
-- status transitions ('active' ↔ 'archived' / 'cancelled') are
-- captured without bespoke logic per event.
CREATE OR REPLACE FUNCTION public.refresh_module_subscriber_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_ids uuid[];
BEGIN
  -- Collect every module_id the firing row(s) reference. UPDATE may
  -- have moved the subscription to a different module (rare but
  -- possible) so we union OLD + NEW.
  IF TG_OP = 'INSERT' THEN
    affected_ids := ARRAY[NEW.module_id];
  ELSIF TG_OP = 'DELETE' THEN
    affected_ids := ARRAY[OLD.module_id];
  ELSE
    -- UPDATE: handle module_id move + status changes.
    affected_ids := ARRAY[OLD.module_id, NEW.module_id];
  END IF;

  UPDATE public.modules m
    SET subscriber_count = (
      SELECT COUNT(*)::int
      FROM public.module_subscriptions s
      WHERE s.module_id = m.id
        AND s.status = 'active'
    )
    WHERE m.id = ANY(affected_ids);

  RETURN NULL;  -- AFTER trigger, return value ignored
END;
$$;

-- Wire the trigger. AFTER so the underlying row change is durable
-- before we recount. STATEMENT-level would lose row context for
-- bulk operations, so ROW-level — bulk subscribes (e.g. a future
-- "subscribe all GMs") would fan out one recount per row, which is
-- acceptable for the small N expected.
DROP TRIGGER IF EXISTS module_subscriptions_refresh_count ON public.module_subscriptions;
CREATE TRIGGER module_subscriptions_refresh_count
  AFTER INSERT OR UPDATE OR DELETE
  ON public.module_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_module_subscriber_count();

-- One-shot backfill — set every module's subscriber_count to its
-- current active subscription count. Run during migration so the
-- denormalized column is correct before any new subscriptions fire
-- the trigger.
UPDATE public.modules m
  SET subscriber_count = COALESCE((
    SELECT COUNT(*)::int
    FROM public.module_subscriptions s
    WHERE s.module_id = m.id
      AND s.status = 'active'
  ), 0);
