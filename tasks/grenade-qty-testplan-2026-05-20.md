# Grenade/Molotov Carry-Quantity Test Plan (2026-05-20)

Per Xero "#1 for grenade" - the carry count lives on the weapon slot (not inventory). Explosives are thrown consumables; a − / N / + stepper lets you set how many the character carries.

**Live URL:** thetapestry.distemperverse.com

---

## Pre-flight (verified)

- [x] `npx tsc --noEmit` clean.
- [x] `npx vitest run tests/lib/` 476/476.
- [x] em-dash / font-size / role-literal guardrails clean.

---

## NPC editor (the screenshot surface) - `NpcRoster.tsx`

1. Open the NPC roster, add/edit an NPC (Foe or Antagonist to get the secondary slot).
2. In the Weapon dropdown, pick **Grenade** (or Molotov).
3. **Expected:** below the weapon detail line (`Athletics · Close · DMG 2+2d6 · RP 100% · ×1`), a **Quantity** stepper appears (− 1 +).
4. Click + a few times -> count rises; − floors at 1. The detail line's `×N` tracks.
5. Pick a non-explosive weapon (e.g. Pistol) -> stepper disappears, no `×N`.
6. Save the NPC. Reopen the editor -> the quantity persists (rides in `skills.weapon.qty` jsonb).
7. On the NPC card (GM view), the weapon chip shows `Grenade · 2+2d6 · Close · ×N`.
8. Secondary weapon slot (Foe/Antagonist): same behavior independently.

## PC creation wizard - `StepEight.tsx`

1. Create a new character, reach the Weapons step.
2. Pick **Grenade** as primary. **Expected:** a "How many Grenades carried?" stepper appears below the ammo control.
3. Set it to 3, finish creation.
4. Open the character sheet -> primary weapon shows `Qty: ×3`.

## PC live sheet (main post-creation surface) - `CharacterCard.tsx`

1. Open a PC character sheet you can edit.
2. Change the primary (or secondary) weapon to **Molotov**.
3. **Expected:** the weapon block shows `Qty: ×1` on the stat line + a **Quantity** stepper above the Upkeep/Unequip row.
4. Step it up to 4. Refresh the page -> persists (`characters.data.weaponPrimary.qty`).
5. Switch the weapon to a Pistol -> Qty + stepper vanish.
6. A viewer without edit rights sees the `×N` but the stepper buttons are disabled.

## Round-trip (edit + print)

1. Edit an existing PC with a grenade qty via `/characters/[id]/edit` -> the wizard loads with the right count (not reset to 1).
2. Print sheet (`toWizardState`) reflects the count.

---

## NOT in this change (follow-up)

- **Throw-time auto-decrement.** Throwing a grenade in combat does NOT yet decrement the carried qty automatically - the stepper is manual (the player/GM adjusts after a throw). Auto-decrement on the explosive attack path (executeRoll) is a separate touch; logged in todo.

---

## Rollback

```sh
git -C /c/TheTapestry revert <pc-commit> <npc-commit> --no-edit
git -C /c/TheTapestry push origin main
```

`qty` is additive on the weapon-slot jsonb; reverting just stops reading/writing it. No schema or migration involved. Existing saved grenades default to ×1 via `?? 1` everywhere.
