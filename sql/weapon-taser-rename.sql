-- Rename melee Taser → Cattle Prod.
-- The old "Taser" entry in weapons.ts was a contact stun (cattle-prod style).
-- That entry has been renamed to "Cattle Prod" and a new projectile "Taser"
-- (with dart range, single-shot, Stun trait) has taken its place.
-- Characters and NPCs who previously had weapon "Taser" meant the melee stun,
-- so we migrate them to "Cattle Prod" to preserve original mechanics.

-- ── Characters (weaponPrimary / weaponSecondary slots) ──
UPDATE public.characters
SET data = jsonb_set(data, '{weaponPrimary,weaponName}', '"Cattle Prod"')
WHERE data->'weaponPrimary'->>'weaponName' = 'Taser';

UPDATE public.characters
SET data = jsonb_set(data, '{weaponSecondary,weaponName}', '"Cattle Prod"')
WHERE data->'weaponSecondary'->>'weaponName' = 'Taser';

-- ── Campaign NPCs (skills.weapon.weaponName) ──
UPDATE public.campaign_npcs
SET skills = jsonb_set(skills, '{weapon,weaponName}', '"Cattle Prod"')
WHERE skills->'weapon'->>'weaponName' = 'Taser';

-- ── World NPCs (same shape as campaign_npcs) ──
UPDATE public.world_npcs
SET skills = jsonb_set(skills, '{weapon,weaponName}', '"Cattle Prod"')
WHERE skills->'weapon'->>'weaponName' = 'Taser';
