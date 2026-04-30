-- Phase E Sprint 5 — Community Subscription. Lets a player "follow"
-- a published community (a world_communities row) so they can track
-- it across sessions and platforms. v1 just persists the bond — the
-- feed surface that consumes it (per-community Campfire feed) is
-- still gated on Phase 4 Campfire shipping.
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.community_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The follower. CASCADE on auth.users delete cleans up cleanly.
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The followed community (world_communities — the public face).
  -- CASCADE so unpublishing or hard-deleting a community removes its
  -- subscriptions automatically.
  world_community_id uuid NOT NULL REFERENCES public.world_communities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One subscription per (user, community) pair. Re-following = no-op.
  CONSTRAINT community_subscriptions_unique_pair UNIQUE (user_id, world_community_id)
);

-- Lookup indexes for the two hot paths: "what does this user follow"
-- (subscribed list on /communities) and "who follows this community"
-- (future fan-out for notifications when the Campfire ships).
CREATE INDEX IF NOT EXISTS idx_community_subscriptions_user
  ON public.community_subscriptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_subscriptions_community
  ON public.community_subscriptions(world_community_id);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE public.community_subscriptions ENABLE ROW LEVEL SECURITY;

-- A user can read their own subscription rows. No cross-user reads;
-- subscriber lists are private until / unless we ship public counts.
DROP POLICY IF EXISTS "community_subscriptions_read_own" ON public.community_subscriptions;
CREATE POLICY "community_subscriptions_read_own"
  ON public.community_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Thrivers can read everything (eventual subscriber-count surfacing).
DROP POLICY IF EXISTS "community_subscriptions_read_thriver" ON public.community_subscriptions;
CREATE POLICY "community_subscriptions_read_thriver"
  ON public.community_subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(p.role) = 'thriver'
    )
  );

-- A user inserts their own follow rows. RLS pins user_id to auth.uid()
-- so a malicious client can't follow on behalf of someone else.
DROP POLICY IF EXISTS "community_subscriptions_insert_own" ON public.community_subscriptions;
CREATE POLICY "community_subscriptions_insert_own"
  ON public.community_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- A user removes their own follows.
DROP POLICY IF EXISTS "community_subscriptions_delete_own" ON public.community_subscriptions;
CREATE POLICY "community_subscriptions_delete_own"
  ON public.community_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- No UPDATE — there's nothing on the row to mutate. Re-following is
-- handled at the app layer by checking existence before insert; the
-- UNIQUE constraint catches double-clicks.
