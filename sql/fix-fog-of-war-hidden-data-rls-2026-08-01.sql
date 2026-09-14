-- Fix: fog-of-war / hidden-NPC concealment was enforced CLIENT-SIDE ONLY.
-- Two separate RLS gaps, both the "duplicate PERMISSIVE policy neutralizes
-- the correctly-scoped one" pattern (PostgreSQL ORs all PERMISSIVE
-- policies together - a second, wider policy on the same table silently
-- defeats a narrower one, same class as last night's sessions/
-- session_attachments fix).
--
-- 1. campaign_npcs had TWO SELECT policies:
--      "Campaign members can read NPCs"        - member OR GM, no
--        hidden_from_players check at all.
--      "Campaign members can read campaign npcs" - GM OR
--        (hidden_from_players = false AND member) - correctly scoped.
--    The first policy's unconditional member grant completely nullified
--    the second's protection. The app treats hidden_from_players as a
--    real security gate (components/NpcRoster.tsx explicitly calls it
--    "the RLS gate") - GM-hidden ambushes/secret NPCs/full stat blocks
--    (attributes, skills, inventory, notes, motivation, complication)
--    were readable by any campaign member via a direct query the whole
--    time, regardless of the GM's hide toggle. This one predates and is
--    independent of the fog-of-war/token finding below - found while
--    investigating it. Fix: drop the wide-open duplicate.
--
-- 2. scene_tokens had TWO SELECT policies ("Campaign members can read
--    tokens" / "Members read tokens"), identical duplicates of each
--    other, NEITHER filtering on is_visible. Any player could read every
--    hidden NPC token's exact grid position, HP, and contents (loot) for
--    any scene in a campaign they belong to via a direct query,
--    completely bypassing the fog-of-war the canvas renders. Fix:
--    consolidate into one policy that requires is_visible = true unless
--    the caller is the scene's GM or the token is their own PC / a token
--    one of their characters co-controls (so a player never loses sight
--    of their own token even if a GM toggle would otherwise hide it).
--
-- tactical_scenes.walls/fog_state were also flagged in the audit as
-- potentially leaking "undiscovered wall/door layouts," but there is no
-- secrecy flag anywhere in the wall-segment schema (kind: wall|door|window
-- + door_open only) - a wall's existence has never been GM-secret content
-- in this data model, only whether it's currently open. Not a bug to fix;
-- noted so it isn't mistaken for one later.

BEGIN;

-- 1. campaign_npcs: drop the wide-open duplicate SELECT policy.
DROP POLICY IF EXISTS "Campaign members can read NPCs" ON public.campaign_npcs;

-- 2. scene_tokens: consolidate the two identical duplicate SELECT
-- policies into one that actually gates on is_visible.
DROP POLICY IF EXISTS "Campaign members can read tokens" ON public.scene_tokens;
DROP POLICY IF EXISTS "Members read tokens" ON public.scene_tokens;

CREATE POLICY "Members read visible tokens" ON public.scene_tokens
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    -- GM always sees everything in their own campaign's scenes.
    EXISTS (
      SELECT 1 FROM tactical_scenes ts
      JOIN campaigns c ON c.id = ts.campaign_id
      WHERE ts.id = scene_tokens.scene_id AND c.gm_user_id = auth.uid()
    )
    OR (
      -- Everyone else must be a campaign member AND the token must
      -- actually be visible to players, unless it's their own.
      EXISTS (
        SELECT 1 FROM tactical_scenes ts
        JOIN campaign_members cm ON cm.campaign_id = ts.campaign_id
        WHERE ts.id = scene_tokens.scene_id AND cm.user_id = auth.uid()
      )
      AND (
        is_visible = true
        OR (character_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM characters ch WHERE ch.id = scene_tokens.character_id AND ch.user_id = auth.uid()
        ))
        OR EXISTS (
          SELECT 1 FROM characters ch
          WHERE ch.user_id = auth.uid() AND ch.id = ANY (scene_tokens.controlled_by_character_ids)
        )
      )
    )
  );

COMMIT;
