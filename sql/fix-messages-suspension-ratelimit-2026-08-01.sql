-- Fix: msg_insert is the only user-generated-content INSERT policy in
-- the schema with no is_user_suspended()/check_rate_limit() gating -
-- forum_threads_insert, lfg_posts_insert, map_pins_insert,
-- war_stories_insert, whispers_insert all check both. A suspended user
-- could keep sending DMs uninterrupted, and there was no cap at all on
-- message volume - script a loop against get_or_create_dm() (enumerable
-- via the profiles username search) and flood every reachable user.
--
-- Fix: add the same two checks, matching the pattern used everywhere
-- else. 120/hour (2/min average) - generous enough for genuine active
-- conversation, bounded against scripted flooding. Highest existing
-- precedent (whispers, in-table chat) is 60/hour; DMs are the platform's
-- primary out-of-table channel so a higher ceiling than in-game chat is
-- reasonable.

BEGIN;

DROP POLICY IF EXISTS msg_insert ON public.messages;
CREATE POLICY msg_insert ON public.messages
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND NOT is_user_suspended()
    AND check_rate_limit('message', 120)
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

COMMIT;
