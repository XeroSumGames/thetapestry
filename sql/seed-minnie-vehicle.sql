-- Seed Minnie vehicle data on Mongrels campaigns that don't already
-- have any vehicles. Safe to re-run — it skips any campaign whose
-- vehicles array is already non-empty so you won't wipe custom edits.
--
-- Long-term this is also seeded by the campaign-creation flow
-- (lib/setting-vehicles.ts → app/stories/new/page.tsx). This SQL is
-- the one-shot backfill for Mongrels campaigns created BEFORE that
-- wiring landed.

UPDATE campaigns SET vehicles = '[
  {
    "id": "minnie-001",
    "name": "Minnie",
    "type": "Recreational Vehicle",
    "rarity": "Common",
    "size": 5,
    "speed": 2,
    "passengers": 5,
    "encumbrance": 100,
    "range": "660 (231/132)",
    "wp_max": 67,
    "wp_current": 67,
    "stress": 0,
    "fuel_max": 4,
    "fuel_current": 4,
    "three_words": "Cramped and Noisy",
    "notes": "An alcohol Distillery has been fitted to this Winnebago \"Minnie\".\n- The still can only be operated when the vehicle is stopped or it has a 50% chance (1-3 on 1d6) of catching fire or exploding.\n- It takes 1 day of gathering materials and 1 day of distilling to produce 2 days of fuel. Requires a Tinkerer or Mechanic* check.\n- There are storage tanks built into the RV''s bodywork that allow for the storage of up to 4 days of fuel.\n- Has a snipernest built on the top, between the AC units, with a fitted sniper rifle that only fires forward in a 90 degree arc.",
    "image_url": null,
    "floorplan_url": "/minnie-floorplan.png",
    "has_still": true,
    "cargo": [
      {"name": "Tactical Vests", "qty": 6, "notes": "-3 DMR/DMM"},
      {"name": "Tactical Helmets", "qty": 6, "notes": "-1 DMR/DMM"},
      {"name": "Tactical Shield", "qty": 2, "notes": "-1 DMR/DMM"},
      {"name": "Automatic Rifles", "qty": 4, "notes": "300 rounds each"},
      {"name": "Shotgun", "qty": 4, "notes": "40 rounds each"},
      {"name": "Heavy Pistols", "qty": 6, "notes": "90 rounds each"},
      {"name": "Light Pistols", "qty": 10, "notes": "90 rounds each"},
      {"name": "Hunting Rifle", "qty": 2, "notes": "50 rounds each"},
      {"name": "Sniper Rifle (fitted)", "qty": 1, "notes": "150 rounds"},
      {"name": "Tactical Batons", "qty": 6, "notes": ""},
      {"name": "Tasers", "qty": 3, "notes": ""},
      {"name": "Grenades", "qty": 20, "notes": ""},
      {"name": "Flash-bang Grenades", "qty": 20, "notes": ""},
      {"name": "Hunting Knives", "qty": 10, "notes": ""},
      {"name": "Bow", "qty": 2, "notes": "60 arrows"},
      {"name": "Binoculars", "qty": 4, "notes": ""},
      {"name": "Walkie-Talkies", "qty": 12, "notes": ""},
      {"name": "First Aid Kit", "qty": 6, "notes": ""},
      {"name": "Angler''s Kit", "qty": 10, "notes": ""},
      {"name": "Toolkit", "qty": 1, "notes": ""},
      {"name": "Mechanic''s Toolkit", "qty": 1, "notes": ""}
    ]
  }
]'::jsonb
WHERE setting = 'mongrels'
  AND (vehicles IS NULL OR vehicles = '[]'::jsonb OR jsonb_array_length(vehicles) = 0);
