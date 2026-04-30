-- Phase E #B — denormalized subscriber count on world_communities.
--
-- Mirrors the modules.subscriber_count pattern (sql/modules-subscriber-count.sql):
-- a counter column kept in sync via INSERT/DELETE triggers on
-- community_subscriptions, so the world-map popup and the Following
-- section can show "★ N followers" without a per-card aggregate query.
--
-- Idempotent. Safe to re-run.

ALTER TABLE public.world_communities
  ADD COLUMN IF NOT EXISTS subscriber_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.world_communities.subscriber_count IS
  'Denormalized count of community_subscriptions rows pointing at this world_communities row. Maintained by trigger; never write directly.';

-- Backfill existing rows (one-time correction in case the table
-- already has subscriptions but a fresh count column).
UPDATE public.world_communities wc
SET subscriber_count = sub.cnt
FROM (
  SELECT world_community_id, COUNT(*)::int AS cnt
  FROM public.community_subscriptions
  GROUP BY world_community_id
) sub
WHERE wc.id = sub.world_community_id;

-- Trigger function — single function handles both INSERT (+1) and
-- DELETE (−1). Skips on TG_OP we don't care about.
CREATE OR REPLACE FUNCTION public.bump_world_community_subscriber_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.world_communities
      SET subscriber_count = subscriber_count + 1
      WHERE id = NEW.world_community_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.world_communities
      SET subscriber_count = GREATEST(0, subscriber_count - 1)
      WHERE id = OLD.world_community_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_bump_world_community_subscriber_count_ins
  ON public.community_subscriptions;
CREATE TRIGGER trg_bump_world_community_subscriber_count_ins
  AFTER INSERT ON public.community_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.bump_world_community_subscriber_count();

DROP TRIGGER IF EXISTS trg_bump_world_community_subscriber_count_del
  ON public.community_subscriptions;
CREATE TRIGGER trg_bump_world_community_subscriber_count_del
  AFTER DELETE ON public.community_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.bump_world_community_subscriber_count();
