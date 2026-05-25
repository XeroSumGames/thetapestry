-- characters-gm-write-rls-2026-05-24.sql
--
-- FIX for the cross-user `characters` write data-loss CLASS (2026-05-24).
--   Finding: tasks/finding-characters-rls-cross-user-writes-2026-05-24.md
--   Risk Register: tasks/debug-handoff.md Sec 1 (RED).
--
-- *** NOT YET APPLIED TO LIVE. *** Bright line (RLS change against prod) -
-- apply ONLY on Xero's explicit go:
--   npx supabase db query --linked -f sql/characters-gm-write-rls-2026-05-24.sql
-- Join verified against live: character_states(character_id, campaign_id) is
-- the character<->campaign link; campaigns.gm_user_id is the GM. NOT executed here.
--
-- ROOT CAUSE (verified live 2026-05-24): `characters` UPDATE RLS is owner-only
-- (`auth.uid() = user_id`) + a Thriver bypass (`is_thriver()`). A GM is NOT a
-- Thriver (`is_thriver()` keys on profiles.role, unrelated to campaigns.gm_user_id).
-- So every client write to ANOTHER player's `characters` row silently no-ops
-- (RLS returns 0 rows, no error) unless the actor happens to be a Thriver. This
-- is LATENT today only because dev/playtest GMs are also Thrivers; at a 500-user
-- beta with non-Thriver GMs it silently destroys data across the whole GM loot/
-- award/ration loop (8 flows; see the finding). Contrast: `character_states`
-- already has a "Campaign members update character_states" (member OR GM) policy,
-- which is why COMBAT (HP/RP/stress/conditions) is safe - only `characters.data`
-- writes (inventory, rations, lasting-wounds, progression-log) are affected.
--
-- THE FIX: add a GM-of-campaign UPDATE policy on `characters`, scoped (NOT a
-- blanket "any member" - that would let any peer rewrite a teammate's whole
-- sheet). Covers flows 2-8 (all GM-acting / GM-mediated). The owner policy is
-- unchanged (players still write their own). Flow 1 (PC->PC item trade, the one
-- true peer-to-peer write) is NOT covered here on purpose - it routes through a
-- dedicated SECURITY DEFINER RPC that touches only the inventory key (so peers
-- can transfer items without arbitrary-edit rights), or is disabled for the
-- beta. See the finding doc.
--
-- Idempotent (DROP POLICY IF EXISTS + CREATE). Additive: only ADDS GM write
-- permission; removes nothing. Revert: DROP POLICY "GM can update characters in their campaigns" ON public.characters;

DROP POLICY IF EXISTS "GM can update characters in their campaigns" ON public.characters;
CREATE POLICY "GM can update characters in their campaigns" ON public.characters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.character_states cs
      JOIN public.campaigns c ON c.id = cs.campaign_id
      WHERE cs.character_id = characters.id
        AND c.gm_user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';

-- POST-APPLY verification (as a GM who is NOT a Thriver, against a player's PC
-- in your campaign): an UPDATE to that character's data should now affect 1 row
-- instead of silently 0. The E2E lane adds the regression assertion (GM loot ->
-- player inventory persists).
