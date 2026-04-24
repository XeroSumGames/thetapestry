-- messages-rls-fix.sql
-- The original cp_select policy was self-referential: it queried
-- conversation_participants from within conversation_participants's own SELECT
-- policy. Postgres breaks that recursion by returning an empty set, so no rows
-- were ever visible and conversations could never load.
--
-- Fix: a SECURITY DEFINER function that runs outside RLS to collect the caller's
-- conversation_ids; both policies reference that function instead of the table.

CREATE OR REPLACE FUNCTION public.my_conversation_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id
  FROM   conversation_participants
  WHERE  user_id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.my_conversation_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_conversation_ids() TO authenticated;

-- Fix cp_select: non-recursive, uses the helper above.
DROP POLICY IF EXISTS "cp_select" ON public.conversation_participants;
CREATE POLICY "cp_select" ON public.conversation_participants
FOR SELECT USING (
  conversation_id IN (SELECT public.my_conversation_ids())
);

-- Fix conv_select: also avoid the potentially problematic cross-table EXISTS.
DROP POLICY IF EXISTS "conv_select" ON public.conversations;
CREATE POLICY "conv_select" ON public.conversations
FOR SELECT USING (
  id IN (SELECT public.my_conversation_ids())
);
