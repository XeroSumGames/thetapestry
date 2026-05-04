# Testplan — Character-sheet Unequip button

**Commit:** `3e2beab` (on main)

## What changed
Added a one-click `UNEQUIP` button on the character sheet's PRIMARY/SECONDARY weapon blocks, sitting beside `UPKEEP CHECK`. Equivalent to selecting "— None —" from the weapon dropdown, but one click. Same orange outline styling as the Ready Weapon modal's Unequip button. Inline sheet (table page) and popout (`/character-sheet`) both use the same `CharacterCard` component, so both got the button in one edit.

**Behavior:** Clears the weapon slot (sets `weaponName: ''`). Does NOT push to inventory. (Sheet equipping isn't inventory-backed — the dropdown lists the full catalog. The combat-time Ready Weapon modal still does inventory-aware unequip; that path is unchanged.)

## Test steps

### Inline sheet (table page)
1. Hard-refresh `/stories/<id>/table`.
2. Open your PC sheet.
3. **Both slots filled:** Confirm UNEQUIP button appears beside UPKEEP CHECK on PRIMARY and SECONDARY blocks.
4. Click UNEQUIP on PRIMARY → weapon name clears, dropdown shows "— None —", weapon detail block (Skill / WP Damage / Range / Condition / Attack) disappears, encumbrance number drops accordingly.
5. Re-equip PRIMARY by picking from the dropdown → weapon and detail block return.
6. **Pristine condition:** Set PRIMARY's condition to Pristine. UPKEEP CHECK should disappear (existing behavior); UNEQUIP should still show.
7. **Empty slot:** With PRIMARY empty (just dropdown, no weapon detail block), confirm UNEQUIP does **not** appear. (It only renders inside the `w &&` block.)
8. **Read-only sheet (other player's PC):** Open another player's character via roster/etc. UNEQUIP and UPKEEP CHECK should both be hidden (`canEdit` gate).

### Popout sheet
9. Open `/character-sheet` (popout window) for one of your PCs.
10. Repeat steps 3–8 in the popout. Behavior should be identical.

### Combat-bar regression check (no change expected)
11. During combat, open the Ready Weapon modal on a PC turn. The original Unequip button (small, top-right of each slot panel) should still work and still push the weapon back to inventory. No double-Unequip / no UI change here.

### Encumbrance sanity
12. Note encumbrance before unequipping (e.g. `8/8`).
13. Unequip a weapon with `enc > 0`.
14. Encumbrance number recomputes correctly (drops by the weapon's enc).
15. Encumbrance bar color flips from red → green if you were OVERLOADED.

## Pass criteria
- One-click unequip works on both inline + popout sheets.
- UNEQUIP only renders when a weapon is equipped + sheet is editable.
- UPKEEP CHECK still gated by `cond !== 'Pristine'` (no regression).
- Combat Ready Weapon modal's Unequip still works as before.
- Font-size guardrail clean: `node scripts/check-font-sizes.mjs` → OK.

## Rollback
Revert `3e2beab` if any of the above fails. Single-file change to `components/CharacterCard.tsx`.
