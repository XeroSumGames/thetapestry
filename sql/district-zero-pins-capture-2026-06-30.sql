-- ============================================================
-- District Zero - corrected pin LOCATIONS capture (2026-06-30)
-- Campaign "District Zero" 6dd8611b-62ef-4810-b998-b9c5682d0a62.
--
-- Xero finalized + reordered the campaign_pins on 2026-06-30. This file is
-- the point-in-time record of their positions (folder, sort_order, lat, lng),
-- keyed by name. Notes/category are intentionally NOT touched here (unchanged;
-- their authored text lives in the live rows + the original district-zero-seed.sql).
--
-- Idempotent and non-destructive: UPDATE-by-name only, so re-running just
-- re-asserts the coordinates. Safe to re-apply to the same campaign. Does NOT
-- create rows (the pins already exist live).
--
-- Live already matches this as of capture, so there is no need to apply it now;
-- it exists as a repo backup / reproducibility artifact for the
-- Path to Citizenship build (tasks/spec-path-to-citizenship.md).
-- ============================================================

BEGIN;

-- Gates (4)
UPDATE campaign_pins SET folder='Gates', sort_order=1,  lat=36.0521826490883, lng=-95.7974982261658 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='West Gate';
UPDATE campaign_pins SET folder='Gates', sort_order=3,  lat=36.0608757492369, lng=-95.7907846570015 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='North Gate';
UPDATE campaign_pins SET folder='Gates', sort_order=3,  lat=36.0554613768467, lng=-95.7617899775505 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='East Gate (Farm Gate)';
UPDATE campaign_pins SET folder='Gates', sort_order=4,  lat=36.046496595018,  lng=-95.7908463478088 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='South Gate';

-- Watchtowers (12)
UPDATE campaign_pins SET folder='Watchtowers', sort_order=1,  lat=36.0522325249383, lng=-95.7973158359528 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 1';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=2,  lat=36.0606979503728, lng=-95.7971361279488 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 2';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=3,  lat=36.0607651670638, lng=-95.7910287380219 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 3';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=4,  lat=36.0606589213001, lng=-95.7799887657166 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 4';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=5,  lat=36.0607564939456, lng=-95.7716524600983 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 5';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=6,  lat=36.0605570119633, lng=-95.7621574401855 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 6';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=7,  lat=36.0551165964255, lng=-95.7619348168373 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 7';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=8,  lat=36.0466006912316, lng=-95.7619321346283 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 8';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=9,  lat=36.0469476776163, lng=-95.7721996307373 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 9';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=10, lat=36.046756835294,  lng=-95.7799673080444 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 10';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=11, lat=36.046861,         lng=-95.791211         WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watchtower 11';
UPDATE campaign_pins SET folder='Watchtowers', sort_order=12, lat=36.046514,         lng=-95.797327         WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Watertower 12';

-- Town Buildings (19)
UPDATE campaign_pins SET folder='Town Buildings', sort_order=1,  lat=36.0508988772024, lng=-95.7899397611618 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='City Hall';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=2,  lat=36.0488474009638, lng=-95.7911360263824 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Farmer''s Market';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=3,  lat=36.0510593498332, lng=-95.7911092042923 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Main Street Tavern';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=4,  lat=36.0505432339898, lng=-95.7916402816773 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The Bike Clinic';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=5,  lat=36.0516491923675, lng=-95.7897734642029 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The Clinic';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=6,  lat=36.0516665406104, lng=-95.7904815673828 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The Vault';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=7,  lat=36.0519961564993, lng=-95.7911145687103 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The Kitchen';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=8,  lat=36.0527161021936, lng=-95.7886254787445 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The College';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=9,  lat=36.0537136064291, lng=-95.7898485660553 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='First Church of the District';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=10, lat=36.0527,           lng=-95.7938           WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The Workshop';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=11, lat=36.053730954217,  lng=-95.7911628484726 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Chamber of Commerce';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=12, lat=36.0549583005061, lng=-95.7903045415878 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The Rose Rooms';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=13, lat=36.0566323179446, lng=-95.7911896705627 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Nate''s Auto Shop';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=14, lat=36.0587486413569, lng=-95.784205198288  WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='Church of Christ';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=15, lat=36.0580070672945, lng=-95.7818448543549 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The Refinery';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=16, lat=36.0474334559855, lng=-95.7805681228638 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The School (Broken Arrow Academy)';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=17, lat=36.0503827603069, lng=-95.7670497894287 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The Farm (District One)';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=18, lat=36.0478129682507, lng=-95.7647833228111 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='David''s Farmhouse';
UPDATE campaign_pins SET folder='Town Buildings', sort_order=19, lat=36.0484743995399, lng=-95.7738947868347 WHERE campaign_id='6dd8611b-62ef-4810-b998-b9c5682d0a62' AND name='The Greenhouse';

COMMIT;

-- Naming flags (not changed - record as authored, surfaced for Xero):
--   * "Watertower 12" looks like a typo for "Watchtower 12".
--   * "The Bike Clinic" (was "The Bike Shop" in the sourcebook) now coexists
--     with "The Clinic" (medical) - confirm the rename is intended.
