-- Inventory #4 — shared community stockpile.
--
-- A row-per-item table so any campaign member can deposit / withdraw
-- without needing to UPDATE the parent communities row (whose update
-- policy is GM-only and can't be field-gated cleanly via RLS).
--
-- Shape mirrors lib/inventory.ts InventoryItem so PCs / NPCs / vehicles
-- / communities all speak the same vocabulary. Stack-merging is done at
-- the app layer: deposits look up by (name, custom) and increment qty
-- if the row exists, else INSERT a new one.
--
-- Idempotent. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.community_stockpile_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name text NOT NULL,
  enc integer NOT NULL DEFAULT 0,
  rarity text NOT NULL DEFAULT 'Common',
  notes text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_stockpile_community_idx
  ON public.community_stockpile_items (community_id);

-- App-layer dedup key — same (community, name, custom) merges into qty.
-- UNIQUE constraint enforces it at the DB layer too in case of races.
CREATE UNIQUE INDEX IF NOT EXISTS community_stockpile_dedup
  ON public.community_stockpile_items (community_id, name, custom);

ALTER TABLE public.community_stockpile_items ENABLE ROW LEVEL SECURITY;

-- Read: any campaign member of the community's campaign.
DROP POLICY IF EXISTS community_stockpile_read ON public.community_stockpile_items;
CREATE POLICY community_stockpile_read
  ON public.community_stockpile_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities c
      LEFT JOIN public.campaign_members cm ON cm.campaign_id = c.campaign_id
      LEFT JOIN public.campaigns ca ON ca.id = c.campaign_id
      WHERE c.id = community_stockpile_items.community_id
        AND (cm.user_id = auth.uid() OR ca.gm_user_id = auth.uid())
    )
  );

-- Write (insert/update/delete): same gate as read. Trusts the UI to
-- only let community members deposit/withdraw, but RLS itself opens
-- to all campaign members so a non-member PC giving a gift to a
-- community in another campaign isn't possible.
DROP POLICY IF EXISTS community_stockpile_insert ON public.community_stockpile_items;
CREATE POLICY community_stockpile_insert
  ON public.community_stockpile_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.communities c
      LEFT JOIN public.campaign_members cm ON cm.campaign_id = c.campaign_id
      LEFT JOIN public.campaigns ca ON ca.id = c.campaign_id
      WHERE c.id = community_stockpile_items.community_id
        AND (cm.user_id = auth.uid() OR ca.gm_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS community_stockpile_update ON public.community_stockpile_items;
CREATE POLICY community_stockpile_update
  ON public.community_stockpile_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities c
      LEFT JOIN public.campaign_members cm ON cm.campaign_id = c.campaign_id
      LEFT JOIN public.campaigns ca ON ca.id = c.campaign_id
      WHERE c.id = community_stockpile_items.community_id
        AND (cm.user_id = auth.uid() OR ca.gm_user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS community_stockpile_delete ON public.community_stockpile_items;
CREATE POLICY community_stockpile_delete
  ON public.community_stockpile_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities c
      LEFT JOIN public.campaign_members cm ON cm.campaign_id = c.campaign_id
      LEFT JOIN public.campaigns ca ON ca.id = c.campaign_id
      WHERE c.id = community_stockpile_items.community_id
        AND (cm.user_id = auth.uid() OR ca.gm_user_id = auth.uid())
    )
  );

-- Force PostgREST to reload its schema cache so the new table is
-- visible to API queries immediately.
NOTIFY pgrst, 'reload schema';
