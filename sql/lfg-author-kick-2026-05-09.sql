-- LFG: post author can kick interested users from their own post.
-- Pairs with the existing "withdraw your own interest" delete policy
-- (lfg_int_delete_own from sql/lfg-interests.sql). Adds a parallel
-- policy so the GM/author can clear someone they're not interested
-- in inviting — useful when the interested list piles up with
-- shoppers who never close.
--
-- Original lfg-interests.sql intentionally blocked author deletes
-- ("would be confusing - leave that to the user"); 2026-05-09 Xero
-- reversed that call - GMs need a kick affordance. The UI surfaces
-- a Kick button next to Invite/Message on the author's own post.

DROP POLICY IF EXISTS "lfg_int_delete_author" ON public.lfg_interests;
CREATE POLICY "lfg_int_delete_author" ON public.lfg_interests
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.lfg_posts p
      WHERE p.id = lfg_interests.post_id
        AND p.author_user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
