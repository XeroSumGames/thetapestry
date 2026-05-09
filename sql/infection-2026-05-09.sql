-- Infection subsystem schema. Adds 5 columns each to
-- character_states and campaign_npcs, mirroring the existing
-- incap_rounds / death_countdown shape. See:
--   - tasks/rules-extract-infection.md (canonical spec)
--   - app/rules/combat/infection (player-facing rules)
--   - memory/project_infection_canon.md (locked design decisions)
--
-- Day-tick is GM-driven: nothing automated here. The GM clicks
-- "Tick Day" on the patient's sheet and infection_days_left
-- decrements by 1. When it hits 0, the application logic fires
-- the Lasting Damage roll (if infection_lasting_risk) and clears
-- the columns.

ALTER TABLE public.character_states
  ADD COLUMN IF NOT EXISTS infection_state         text         NULL,
  ADD COLUMN IF NOT EXISTS infection_days_left     smallint     NULL,
  ADD COLUMN IF NOT EXISTS infection_lasting_risk  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS infection_started_at    timestamptz  NULL,
  ADD COLUMN IF NOT EXISTS infection_infected_by   text         NULL;

ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS infection_state         text         NULL,
  ADD COLUMN IF NOT EXISTS infection_days_left     smallint     NULL,
  ADD COLUMN IF NOT EXISTS infection_lasting_risk  boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS infection_started_at    timestamptz  NULL,
  ADD COLUMN IF NOT EXISTS infection_infected_by   text         NULL;

-- Sanity constraints. infection_state is a closed set; days_left
-- is non-negative; if state is set, days_left must be present.
ALTER TABLE public.character_states
  DROP CONSTRAINT IF EXISTS character_states_infection_state_check;
ALTER TABLE public.character_states
  ADD CONSTRAINT character_states_infection_state_check
  CHECK (infection_state IS NULL OR infection_state IN ('wound', 'sickness'));

ALTER TABLE public.campaign_npcs
  DROP CONSTRAINT IF EXISTS campaign_npcs_infection_state_check;
ALTER TABLE public.campaign_npcs
  ADD CONSTRAINT campaign_npcs_infection_state_check
  CHECK (infection_state IS NULL OR infection_state IN ('wound', 'sickness'));

ALTER TABLE public.character_states
  DROP CONSTRAINT IF EXISTS character_states_infection_days_left_check;
ALTER TABLE public.character_states
  ADD CONSTRAINT character_states_infection_days_left_check
  CHECK (infection_days_left IS NULL OR infection_days_left >= 0);

ALTER TABLE public.campaign_npcs
  DROP CONSTRAINT IF EXISTS campaign_npcs_infection_days_left_check;
ALTER TABLE public.campaign_npcs
  ADD CONSTRAINT campaign_npcs_infection_days_left_check
  CHECK (infection_days_left IS NULL OR infection_days_left >= 0);

-- PostgREST schema cache reload so the new columns are visible
-- to the API immediately.
NOTIFY pgrst, 'reload schema';
