-- Adds an inventory column to campaign_npcs so NPCs can hold looted items.
-- Mirrors the shape of characters.data.inventory: [{ name, qty, enc, rarity, notes, custom }]
ALTER TABLE campaign_npcs ADD COLUMN IF NOT EXISTS inventory jsonb DEFAULT '[]'::jsonb;
