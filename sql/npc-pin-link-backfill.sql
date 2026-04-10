-- ============================================================
-- NPC ↔ Campaign Pin Link — Schema + Backfill
-- Run this entire block in the Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- ============================================================

-- ── 0. Sanity check ──────────────────────────────────────────
-- If this returns no rows, the campaign_npcs table isn't in the public schema.
-- Run this first manually:
--   SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%npc%';

-- ── 1. Ensure column exists ──────────────────────────────────
ALTER TABLE public.campaign_npcs
  ADD COLUMN IF NOT EXISTS campaign_pin_id uuid REFERENCES public.campaign_pins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaign_npcs_pin_id_idx ON public.campaign_npcs(campaign_pin_id);


-- ── 2. Backfill existing campaigns by name match ─────────────
-- Maps NPC name → seed pin_title (mirrors lib/setting-npcs.ts).
-- The join also requires the pin to belong to the same campaign as the NPC,
-- so cross-campaign collisions are impossible.

WITH npc_pin_titles(npc_name, pin_title) AS (
  VALUES
    -- District Zero ────────────────────────────────────────
    ('Lincoln "Linc" Sawyer',     '01 | City Hall'),
    ('Mitchell "Mitch" Kosinski', '01 | City Hall'),
    ('District Deputy',           '01 | City Hall'),
    ('Tom Orchard',               '02 | Farmer''s Market'),
    ('Jemimah Sawyer',            '03 | Main Street Tavern'),
    ('Emma Hernandez',            '04 | The Bike Shop'),
    ('Morgan Lieu',               '05 | The Clinic'),
    ('Nana Welch',                '07 | The Kitchen'),
    ('Carol Philips',             '08 | The College'),
    ('Nate Landry',               '09 | The Workshop'),
    ('Father Donalds',            '10 | First Church of the District'),
    ('Wesley Spencer',            '11 | Chamber of Commerce'),
    ('Marcy Cunningham',          '12 | The Rose Rooms'),
    ('Johnson Walker',            '13 | Nate''s Auto Shop'),
    ('Milo Cantwell',             '14 | Church of Christ'),
    ('Gio Leone',                 '15 | The Refinery'),
    ('Jeremy Barrow',             '16 | The School (Broken Arrow Academy)'),
    ('David Battersby',           '17 | The Farm (District One)'),

    -- Chased / Empty ───────────────────────────────────────
    ('Maddy Bell',                '01 | Best Nite Motel'),
    ('Troy & Mark Bell',          'Connor Boys Farmhouse'),
    ('Luke Connor',               'The Encounter — Forest Clearing'),
    ('Owen Connor',               'Owen Connor''s Ambush Point'),
    ('Donnie McHenry',            'Connor Boys Farmhouse'),
    ('Junior Connor',             'Connor Boys Farmhouse'),
    ('Silas McHenry',             'Connor Boys Farmhouse'),
    ('Ray Connor',                '01 | Best Nite Motel'),
    ('Jackie Connor',             '01 | Best Nite Motel'),
    ('William Robertson',         '01 | Best Nite Motel'),
    ('Caleb Robertson',           '01 | Best Nite Motel'),
    ('Carol Robertson',           '01 | Best Nite Motel'),
    ('Bobby Robertson',           '01 | Best Nite Motel'),
    ('Jemmy Robertson',           '01 | Best Nite Motel'),
    ('Paula Ortiz',               '01 | Best Nite Motel'),
    ('Milton Ortiz',              '01 | Best Nite Motel'),
    ('Nick Manson',               '01 | Best Nite Motel'),
    ('Eric Rose',                 '01 | Best Nite Motel'),
    ('Macy Stevens',              '01 | Best Nite Motel'),
    ('Mikey Doyle',               '01 | Best Nite Motel'),
    ('Art Buchanan',              '01 | Best Nite Motel'),
    ('Dylan',                     'Stansfield''s Gas Station'),
    ('Becky',                     'Stansfield''s Gas Station')
)
UPDATE public.campaign_npcs cn
SET campaign_pin_id = cp.id
FROM npc_pin_titles npt
JOIN public.campaign_pins cp ON cp.name = npt.pin_title
WHERE cn.name = npt.npc_name
  AND cp.campaign_id = cn.campaign_id
  AND cn.campaign_pin_id IS NULL;
