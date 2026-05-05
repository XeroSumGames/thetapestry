-- mongrels-pin-chronological-order.sql
-- Reset Mongrels campaign pins to chronological route order.
--
-- Source of truth: lib/setting-handouts.ts "The Route" day-by-day
-- table + the per-pin notes describing where each Landmark / Set
-- Piece sits in the narrative. 14 waypoints + 14 landmarks = 28 pins.
--
-- Hells Hole Spring (start, Day 0) is #1. Bozeman (final, Day 37)
-- is #28. Everything else is interleaved into the day it appears.
--
-- Idempotent: re-running just rewrites the same numbers. Only
-- affects the campaign id below — Xero's Mongrels (Minnie & The
-- Magnificent Mongrels). Other campaigns' pin orders are untouched.

UPDATE public.campaign_pins p
SET sort_order = v.new_order
FROM (VALUES
  ('Hells Hole Spring, AZ',                          1),
  ('Canyon Lake Marina & Campground',                2),
  ('Apache Junction Territorial Line',               3),
  ('Tonto National Forest SR-87 Entry',              4),
  ('Beeline Highway SR-87 Switchbacks',              5),
  ('Payson, AZ',                                     6),
  ('Lowell Observatory',                             7),
  ('Flagstaff, AZ',                                  8),
  ('Cameron, AZ',                                    9),
  ('Cameron Old Bridge (Tanner''s Crossing 1911)',  10),
  ('Cameron Trading Post',                          11),
  ('Little Colorado River Gorge',                   12),
  ('Page, AZ',                                      13),
  ('Glen Canyon Dam',                               14),
  ('Vermillion Cliffs SR-89',                       15),
  ('Kanab, UT',                                     16),
  ('Church Wells',                                  17),
  ('Cedar City, UT',                                18),
  ('Cedar Breaks National Monument',                19),
  ('Fanatics Roadblock I-15 North',                 20),
  ('Holden, UT',                                    21),
  ('Provo, UT',                                     22),
  ('Salt Lake City, UT',                            23),
  ('Logan, UT',                                     24),
  ('Pocatello, ID',                                 25),
  ('Idaho Falls, ID',                               26),
  ('Dillon, MT',                                    27),
  ('Bozeman, MT',                                   28)
) AS v(pin_name, new_order)
WHERE p.campaign_id = 'cc766e7f-04de-4d09-a497-ce6c8e21b53d'
  AND p.name = v.pin_name
RETURNING p.sort_order, p.name;
