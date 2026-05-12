-- ============================================================
-- Campaign Clock — Phase 1 backbone
-- Run in Supabase SQL Editor. Idempotent.
-- ============================================================
-- Adds the in-world clock to campaigns + the pending-events queue
-- that future phases will drain on time advance. See
-- tasks/spec-campaign-sheet.md for the full design.

-- ── campaigns.clock ───────────────────────────────────────────
-- canon_day = days since 2-Mar-Year1 (first recorded death).
-- hour      = 0-23 in-world time within the day.
-- Default 0/0 = the very first moment of the pandemic. New
-- campaigns will set canon_day to their canonical start day
-- (Chased=379, On The Waterfront=480, Mongrels=563, etc.).
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS clock jsonb NOT NULL DEFAULT '{"canon_day": 0, "hour": 0}'::jsonb;

COMMENT ON COLUMN public.campaigns.clock IS
  'In-world clock for the campaign sheet. {canon_day: int, hour: 0-23}. canon_day = days since 2-Mar-Year1 (first death). Advanced via lib/campaign-clock.ts:advance().';

-- ── campaign_events table ────────────────────────────────────
-- Every "thing that happens over time" — pending heals, streaming
-- heals, ration consumption, subsistence damage, world event
-- expirations — lives here as a row. The clock helper drains
-- pending rows whose scheduled (canon_day, hour) is <= the new
-- clock state, applying their type-specific effect.
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  scheduled_canon_day int NOT NULL,
  scheduled_canon_hour int NOT NULL DEFAULT 0 CHECK (scheduled_canon_hour BETWEEN 0 AND 23),
  applied_canon_day int,
  applied_canon_hour int,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.campaign_events IS
  'Queue of "over time" effects waiting to be drained by lib/campaign-clock.ts:advance(). One row per pending effect (heals, rations, subsistence, world-event expiry, etc.). applied_canon_day/hour are set when the effect fires; cancelled_at when the effect was interrupted (e.g. damage during a streaming heal).';

-- Index for the hot-path query: "give me all pending events for
-- this campaign that should fire on advance to the new clock".
-- Partial index excludes already-applied and cancelled rows so
-- the index size stays bounded as the campaign accumulates
-- historical events.
CREATE INDEX IF NOT EXISTS campaign_events_pending_idx
  ON public.campaign_events (campaign_id, scheduled_canon_day, scheduled_canon_hour)
  WHERE applied_canon_day IS NULL AND cancelled_at IS NULL;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

-- SELECT: campaign members + GM can read all of the campaign's events.
DROP POLICY IF EXISTS "Members read campaign events" ON public.campaign_events;
CREATE POLICY "Members read campaign events"
  ON public.campaign_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = campaign_events.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_events.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- INSERT: campaign members + GM can queue events (so heal rolls,
-- ration ticks, etc. fired from any client can drop rows). The
-- helper's `advance()` runs from the GM's client so GM membership
-- is sufficient — but member-INSERT is also allowed so a player's
-- own Stabilize roll can queue a streaming_heal without bouncing
-- through the GM.
DROP POLICY IF EXISTS "Members insert campaign events" ON public.campaign_events;
CREATE POLICY "Members insert campaign events"
  ON public.campaign_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm
      WHERE cm.campaign_id = campaign_events.campaign_id
        AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_events.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- UPDATE: GM only. Stamping applied_at and cancelled_at is
-- authoritative — players shouldn't be able to retroactively mark
-- effects as "done" or "cancelled" on their own.
DROP POLICY IF EXISTS "GM updates campaign events" ON public.campaign_events;
CREATE POLICY "GM updates campaign events"
  ON public.campaign_events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_events.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_events.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- DELETE: GM only. Cleanup of mistakenly-queued events.
DROP POLICY IF EXISTS "GM deletes campaign events" ON public.campaign_events;
CREATE POLICY "GM deletes campaign events"
  ON public.campaign_events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_events.campaign_id
        AND c.gm_user_id = auth.uid()
    )
  );

-- PostgREST schema cache must reload to pick up the new column
-- and table. Without this, the first signup / clock-write after
-- the migration silently strips the new shape from API payloads.
NOTIFY pgrst, 'reload schema';
