-- Tactical-map render fix (P0) - scale sentinel + deterministic natural dims.
-- Spec: tasks/tactical-map-render-fix-spec-2026-05-26.md  (sections 4.1, 6).
-- Owner: Puffer Fish. Apply: BRIGHT LINE - confirm with Xero before running on live.
--   npx supabase db query --linked -f sql/tactical-scenes-scale-sentinel-2026-05-26.sql
--
-- WHY: `tactical_scenes.img_scale` is overloaded - the value `1` means BOTH
-- "unset/default" AND "100%". The client auto-fits whenever img_scale is 1 or NULL,
-- which is the root of the per-client map divergence. This migration distinguishes
-- "unset" (NULL) from a real scale, so the corrected client (HP) can: render the bg
-- at the STORED shared scale for everyone, and only compute+persist a fit-to-grid
-- scale ONCE when it's NULL. Per-client viewport fit moves to zoom (see spec section 4).
--
-- BACKWARD-COMPATIBLE: the CURRENT live client treats `img_scale == null || == 1`
-- identically (both -> local auto-fit), so applying this BEFORE the HP client change
-- causes no behaviour change. Safe to land ahead of the render rewrite.
--
-- ROLLBACK: re-add the default + NOT NULL and backfill 1:
--   UPDATE public.tactical_scenes SET img_scale = 1 WHERE img_scale IS NULL;
--   ALTER TABLE public.tactical_scenes ALTER COLUMN img_scale SET DEFAULT 1;
--   ALTER TABLE public.tactical_scenes ALTER COLUMN img_scale SET NOT NULL;
--   (natural_w/natural_h can stay; they're additive + nullable.)

begin;

-- 1. img_scale: drop NOT NULL + default so NULL can mean "unset".
alter table public.tactical_scenes alter column img_scale drop not null;
alter table public.tactical_scenes alter column img_scale drop default;

-- 2. Backfill the overloaded literal-1 default -> NULL so those scenes recompute the
--    correct shared fit-to-grid scale on next GM load. (Scenes set to a deliberate
--    non-1 value by /tools/rescale-tactical-scenes keep their value.)
update public.tactical_scenes set img_scale = null where img_scale = 1;

-- 3. Store the background's natural pixel dims (nullable; filled by the client on
--    upload / first load). Lets the corrected renderer compute the shared scale
--    deterministically without fetching the image to read its size.
alter table public.tactical_scenes add column if not exists natural_w integer;
alter table public.tactical_scenes add column if not exists natural_h integer;

commit;

-- Verify:
select count(*) filter (where img_scale is null)  as unset_scenes,
       count(*) filter (where img_scale is not null) as scaled_scenes,
       count(*) filter (where natural_w is not null)  as have_natural_dims
from public.tactical_scenes;
