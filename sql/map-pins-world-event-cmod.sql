-- Communities Phase E — World Event CMod propagation (spec-communities.md §13 #1)
--
-- Distemper Timeline pins (map_pins.category='world_event') can now
-- apply a temporary CMod to the Weekly Morale Check of every community
-- whose Homestead falls inside a configurable radius. Without these
-- columns the GM had to remember which world events were active and
-- type their effect into the Additional slot by hand for every check.
--
-- Columns are nullable / opt-in — a timeline pin without `cmod_impact`
-- set stays purely narrative and never auto-applies. Setting cmod_active
-- = true is the explicit "this event is currently affecting the world"
-- toggle the GM controls.

ALTER TABLE public.map_pins
  ADD COLUMN IF NOT EXISTS cmod_impact integer,
  ADD COLUMN IF NOT EXISTS cmod_radius_km integer,
  ADD COLUMN IF NOT EXISTS cmod_label text,
  ADD COLUMN IF NOT EXISTS cmod_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.map_pins.cmod_impact IS
  'CMod the world event applies to nearby communities'' Morale Checks (e.g. -2 for a plague). NULL = narrative-only event, no auto-effect.';
COMMENT ON COLUMN public.map_pins.cmod_radius_km IS
  'Reach of the event in kilometers. NULL = use default (500 km, applied client-side).';
COMMENT ON COLUMN public.map_pins.cmod_label IS
  'Short label shown in the Morale modal World Events slot. NULL = fall back to map_pins.title.';
COMMENT ON COLUMN public.map_pins.cmod_active IS
  'Explicit on/off toggle. true = event currently applies. The GM flips this off when the event resolves.';

-- Index for the propagation lookup. The morale modal queries
-- "all active world events with a non-null cmod_impact" then runs
-- haversine in JS — this index keeps that query fast even as the
-- timeline grows.
CREATE INDEX IF NOT EXISTS map_pins_active_world_events_idx
  ON public.map_pins (category)
  WHERE category = 'world_event' AND cmod_active = true AND cmod_impact IS NOT NULL;
