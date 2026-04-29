-- Rename setting key: kings_crossing_mall → kings_crossroads_mall
--
-- "Kings Crossroads" is the actual Delaware geographic location
-- (Sussex County, near Greenwood) — earlier code shipped with the
-- typo'd "Crossing." Updates every row that stores the setting
-- value as a string so existing campaigns + seed data point at the
-- new key.
--
-- Apply ONCE via Supabase SQL editor. Idempotent — re-runnable
-- without effect once all rows have moved over.

-- 1. Existing campaigns
update public.campaigns
   set setting = 'kings_crossroads_mall'
 where setting = 'kings_crossing_mall';

-- 2. Setting seed tables — pins / npcs / scenes / handouts.
--    Each is keyed by `setting` text. Skip the update silently
--    if the table or rows don't exist (legacy projects without
--    the seed schema applied).
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'setting_seed_pins') then
    update public.setting_seed_pins set setting = 'kings_crossroads_mall' where setting = 'kings_crossing_mall';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'setting_seed_npcs') then
    update public.setting_seed_npcs set setting = 'kings_crossroads_mall' where setting = 'kings_crossing_mall';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'setting_seed_scenes') then
    update public.setting_seed_scenes set setting = 'kings_crossroads_mall' where setting = 'kings_crossing_mall';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'setting_seed_handouts') then
    update public.setting_seed_handouts set setting = 'kings_crossroads_mall' where setting = 'kings_crossing_mall';
  end if;
end $$;
