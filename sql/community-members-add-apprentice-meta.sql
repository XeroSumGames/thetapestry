-- Phase B+ — Apprentice creation flow (SRD §08 p.21 / spec-communities §2a).
-- Stores the Apprentice's locked-at-recruit-time character data plus the
-- wizard-completion flag. Set in two phases:
--
--   1. When the master PC clicks "Take as Apprentice" on a Moment-of-
--      High-Insight recruit result, the recruit modal auto-rolls 2d6 on
--      both the Motivation (Table 7) and Complication (Table 6) tables
--      and writes them here. These are inherent character — the player
--      does NOT get to reroll or choose.
--
--   2. When the master PC opens the Apprentice creation wizard from the
--      NPC card, picks a Paradigm, spends the 3 CDP RAPID + 5 CDP skill
--      budget, and writes a freeform background, the wizard's Save
--      flips `setup_complete` to true and stores the rest of the meta.
--      The campaign_npcs row gets the actual RAPID + skills updates;
--      this column carries only the meta the NPC row can't represent.
--
-- jsonb shape (post-wizard):
--   {
--     motivation: 'Reunite',          -- MOTIVATIONS[total]
--     motivation_roll: 9,             -- raw 2d6
--     complication: 'Dark Secret',    -- COMPLICATIONS[total]
--     complication_roll: 7,
--     paradigm: 'Rural Sheriff',      -- PARADIGMS[].name
--     background: 'Daughter of the…', -- freeform Fill In The Gaps
--     setup_complete: true,
--     setup_at: '2026-04-29T…'
--   }
--
-- Pre-wizard (just the locked-in roll results):
--   { motivation, motivation_roll, complication, complication_roll,
--     setup_complete: false }
--
-- Idempotent — IF NOT EXISTS guards the column add.

ALTER TABLE public.community_members
  ADD COLUMN IF NOT EXISTS apprentice_meta jsonb;

-- Optional convenience index for "show me Apprentices that need wizard setup":
-- partial index on rows where the meta exists but setup_complete is false.
CREATE INDEX IF NOT EXISTS idx_community_members_apprentice_pending
  ON public.community_members ((apprentice_meta->>'setup_complete'))
  WHERE apprentice_meta IS NOT NULL
    AND (apprentice_meta->>'setup_complete') = 'false';
