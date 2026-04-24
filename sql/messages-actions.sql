-- messages-actions.sql
-- Adds archive support to conversation_participants and a user_blocks table.

-- Archive flag — soft-hide a conversation for this participant only.
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- User blocks — blocker hides DMs from blocked and can't receive new ones.
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "blocks_select" ON public.user_blocks;
CREATE POLICY "blocks_select" ON public.user_blocks
  FOR SELECT USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocks_insert" ON public.user_blocks;
CREATE POLICY "blocks_insert" ON public.user_blocks
  FOR INSERT WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS "blocks_delete" ON public.user_blocks;
CREATE POLICY "blocks_delete" ON public.user_blocks
  FOR DELETE USING (blocker_id = auth.uid());
