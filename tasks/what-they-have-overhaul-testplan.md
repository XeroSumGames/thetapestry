# "What They Have" overhaul testplan

Verifies the redesigned StepEight (character creation weapons + equipment picker) plus the new weapon dropdowns on StepNine (Final Touch).

**No SQL migration required** — UI-only refactor. The character record schema is unchanged; `weaponPrimary` / `weaponSecondary` / `equipment` / `incidentalItem` / `rations` are still strings on `WizardState`.

---

## What changed

### StepEight (`/components/wizard/StepEight.tsx`)

**Weapon picker:**
- **Catalog source switched** from `lib/xse-schema.ts` (Melee + Ranged only, 33 weapons) to `lib/weapons.ts` (canonical 42-weapon catalog covering all 4 categories). Names are 1:1 identical for the overlap, so prior characters' loadouts still resolve.
- **5 tabs** instead of 3: All / Melee / Ranged / Heavy / Explosive. Heavy Weapons + Demolitions + Explosives PCs can now build their loadout in-wizard instead of post-creation.
- **Search input** on each weapon section. Substring-matches case-insensitive against name + traits + skill.
- **Compact single-row layout** per weapon. Was a 2-column dense card grid; now a single column of compact rows showing category chip + name + rarity + range + damage + RP + ENC + clip + traits in one line.
- **Selected weapon shows "✓ Picked" badge** + red border. Clicking a selected weapon clears the slot.
- **Pre-existing `fontSize: '8.5px'` violations fixed** — the old layout had three category chip elements at 8.5px (well below the 13px floor); the rebuild uses Carlito 13px throughout.

**Equipment picker:**
- **Rarity tabs** added (All / Common / Uncommon / Rare).
- **Search input** filters across the active tab against name + notes.
- **Compact row layout** mirrors the weapon picker.
- Curated incidental item list (10 items) preserved as a 3-column button grid below the equipment picker — same data, no functional change.

**Incidental + Rations sections** unchanged.

### StepNine (`/components/wizard/StepNine.tsx`)

- **Primary + Secondary weapon fields are now `<select>` dropdowns** over the full 42-weapon catalog. Player can swap their seeded loadout from the Final Touch screen without backtracking through Step 8.
- Each option label reads `<Name> (<category> · <damage>)` for at-a-glance scanning.
- Picking a different weapon clears the corresponding ammo (`primaryAmmo: 0` / `secondaryAmmo: 0`) since the ammo roll on Step 8 was tied to the previously-picked weapon's clip status.
- All other fields (ammo display, equipment, incidental, rations) stay readonly — they're set on Step 8.

---

## 1. Smoke test — StepEight loads without errors

1. Start a new character via `/characters/new` (Backstory Generation).
2. Advance through the wizard to Step 8 (What They Have).
3. The page should render without console errors. Two weapon sections (Primary + Secondary), Equipment picker, Incidental, Rations.
4. Each weapon section starts on the **All** tab with the search input empty. The list shows all 42 weapons in a scrollable column (max ~320px tall).

## 2. Weapon tabs

1. Click each tab in turn: **Melee** → 18 weapons, **Ranged** → 14 weapons, **Heavy** → 3 weapons, **Explosive** → 6 weapons. (Weapon counts come from `lib/weapons.ts` — verify with `grep -c "category: 'X'"`.)
2. Confirm Heavy lists the M60, Mounted Turret, Flame-Thrower (or whatever `lib/weapons.ts` carries).
3. Confirm Explosive lists Grenade, Mortar, Molotov, Rocket Launcher, etc.
4. **Pre-overhaul gap closed:** in the old wizard, Heavy + Explosive PCs couldn't pick their primary weapon at creation time — now they can.

## 3. Weapon search

1. Set tab to **All**, type `bow` in the search input.
2. List narrows to ~3 hits (Bow, Compound Bow, Crossbow). Substring is case-insensitive.
3. Type `automatic` — list narrows to the weapons with the `Automatic Burst` trait (Assault Rifle, Carbine, etc.).
4. Type `ranged combat` — list narrows to weapons with the `Ranged Combat` skill.
5. Clear the search → all weapons return.

## 4. Pick + clear weapon

1. Click any weapon row → it gets a red border + "✓ Picked" badge. State updates: `weaponPrimary` (or `weaponSecondary`) is set.
2. Click the same weapon row again → it deselects. State clears to `''`.
3. Click a DIFFERENT weapon → that one becomes the picked one; the previous is no longer highlighted.

## 5. Ammo roll for ranged weapons

1. Pick a weapon with a clip (e.g. Light Pistol, Hunting Rifle).
2. Below the weapon list, an "Starting ammo for <name>" row appears with a Roll 1d3 button.
3. Click → state's `primaryAmmo` (or `secondaryAmmo`) gets a value 1-3 + label updates to "X reload(s)".
4. Pick a weapon WITHOUT a clip (e.g. Baseball Bat, Grenade) → the ammo row hides.

## 6. Equipment picker

1. Default tab = All, search empty. List shows ~25 items (full EQUIPMENT minus the 10 reserved for the Incidental Item section).
2. Click rarity tabs:
   - Common → the common subset.
   - Uncommon → the uncommon subset.
   - Rare → just the Rare entries (Criminal Lockpicks).
3. Search "rope" → narrows to Rope.
4. Search "vision" → narrows to Night Vision Goggles.
5. Pick an item → highlighted + "✓ Picked" badge. `state.equipment` updates.
6. Click again to clear.

## 7. Incidental + Rations unchanged

1. Incidental item button grid (3 columns, 10 items) renders as before.
2. Custom-text input below it still works — typing replaces any selected button choice.
3. Rations grid (3 items: Standard / Luxury / Military Grade) renders as before.

## 8. StepNine — weapon dropdowns

1. Advance to Step 9 (Final Touch).
2. The "Weapons & gear" section shows two `<select>` dropdowns at the top: Primary weapon, Secondary weapon. Both default to whatever the player picked on Step 8 (or the Paradigm-seeded values for Random flows).
3. Open the Primary dropdown → all 42 weapons listed, each labeled `<Name> (<category> · <damage>)`. Select a different one.
4. The Primary ammo readonly field below resets to "—" (since picking a new weapon clears `primaryAmmo` to 0).
5. Same for Secondary.
6. Equipment, Incidental item, and Rations fields stay readonly text inputs — to change those, go back to Step 8.

## 9. Random Character + Paradigm seed compatibility

1. Use `/characters/random` — pick a Paradigm that pre-seeds weapons (e.g. School Teacher → Light Pistol + Kitchen Knife).
2. Confirm `weaponPrimary` and `weaponSecondary` survive the wizard transitions and reach Step 8 / Step 9 with the seeded names already selected.
3. On Step 9, the dropdowns default to the seeded values. Player can swap.
4. Save the character → the persisted record has the correct (possibly swapped) weapon names.

## 10. Quick Character flow

1. `/characters/quick` runs through StepEight too. Confirm the new layout renders correctly inside that flow's wrapper.
2. Picking a weapon on Step 8 in Quick mode → reaches the saved character.

## 11. PrintSheet regression

`PrintSheet.tsx` still imports `MELEE_WEAPONS` + `RANGED_WEAPONS` from `xse-schema.ts` (not changed in this overhaul). Confirm character print sheets still render weapon details correctly:
1. After saving a character with a Heavy or Explosive weapon, open print preview.
2. The weapon name is shown but the schema-side weapon database lookup may fail since Heavy/Explosive aren't in `xse-schema.ts`. **Expected behavior:** the print sheet falls back to displaying just the name without detailed stats. Acceptable — full lookup integration is a separate follow-up.

## 12. TypeScript / guardrails

- `npx tsc --noEmit` clean ✅
- `node scripts/check-font-sizes.mjs` — only the two pre-Phase-4 offenders flag (TradeNegotiationModal:217, CampaignCommunity:2415). The three `fontSize: '8.5px'` violations on the OLD StepEight are gone in the rebuild ✅

---

## Open follow-ups

1. **PrintSheet.tsx weapon lookup** — extend its catalog import to `lib/weapons.ts` so Heavy + Explosive weapons render with full stats on the print sheet. ~20 minutes; out of scope for this overhaul to keep the diff focused on character creation.
2. **Tooltips throughout character creation** (separate todo item from the outstanding-work doc) — hover explanations on skills + RAPID + traits would pair naturally with the new compact rows. Future polish.
3. **Pre-roll Insight Die check on Step 8 weapon picker** — players with Insight Dice from creation can theoretically spend them, but the wizard doesn't surface that. Out of scope.

---

## Rollback

`git revert <commit>`. The three modified files (`StepEight.tsx`, `StepNine.tsx`, `outstanding-work-2026-05-01.md`) revert cleanly.
