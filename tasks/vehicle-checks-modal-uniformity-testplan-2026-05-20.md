# Vehicle Checks Modal Uniformity - Test Plan (2026-05-20)

**Branch:** `claude/brew-modal`
**Scope:** all four vehicle check kinds (driving / brew / navigate / attack) now render through the canonical `<RollModal>` shell.
**Time budget:** ~5 minutes manual smoke per check kind. Unit coverage unchanged (state machine + rollCheck untouched).

---

## Pre-flight (already verified)

- [x] `npx tsc --noEmit` - clean.
- [x] `npx vitest run tests/lib/` - 419/419 pass.
- [x] Guardrails (em-dashes / font-sizes / role-literals) - clean.

---

## What changed

- Replaced the ~225-line bespoke `ModalBackdrop`-based modal in `app/vehicle/page.tsx` (L1899-2124) with a `<RollModal>` instance.
- AMOD/SMOD inputs replaced by read-only chips (uniform with Stabilize / Distract / Recruit / FI / Gut Instinct / Stress Check / Coordinated Effort / etc.).
- CMOD stays editable.
- Brew skill toggle (Mechanic*/Tinkerer), Navigate skill picker, and Attack target picker all moved into `preRollExtras`.
- Brewing supplies error + out-of-arc + out-of-range warnings moved into `warnings` slot.
- Result panel (outcome banner + fuel-produced badge + attack hit/miss reminder) rendered via `renderOutcome`.

State machine + `rollCheck` function + label generation + DB writes + initiative-action decrement + brewing-supplies decrement: ALL UNCHANGED.

---

## Manual smoke - Driving Check

1. Open a vehicle popout from /table (click MOVE HERE or open the vehicle sheet).
2. Click "🚗 Driving Check" in the Driver row.
3. Modal opens. **Expected:**
    - Title: "Driving Check"
    - Subtitle: `<driver-name> · <vehicle-name>`
    - Formula: "2d6 + AMOD + SMOD + CMOD"
    - AMOD/SMOD read-only chips reflect driver's DEX + Driving level
    - CMOD editable
    - No pre-roll extras (driving has none)
4. Roll. **Expected:** standard outcome banner + dice line. No bespoke badge (driving narrative lives in feed, not modal).
5. Feed row reads "DRIVE &lt;driver&gt; drives &lt;vehicle&gt; ..." per the locked narrative.

## Manual smoke - Brew Check

1. Vehicle with `has_still = true` and `brewing_supplies_current > 0`.
2. Click "⚗️ Brew Check" in the Brewer row.
3. **Expected:**
    - Title: "Brew Check"
    - Subtitle: `<brewer> · <vehicle>`
    - Pre-roll extras: two-button toggle "Mechanic* (RSN +N · Skill +N)" / "Tinkerer (DEX +N · Skill +N)"
    - Clicking the toggle swaps AMOD+SMOD chips to the chosen attribute/skill
4. Roll a success. **Expected:**
    - Outcome banner
    - **Green badge below**: "⛽ +1 day fuel produced"
    - Vehicle's `fuel_current` increments (visible after modal close on the vehicle stats line)
    - `brewing_supplies_current` decrements by 1
5. Roll a failure. **Expected:**
    - Outcome banner (no fuel badge)
    - `fuel_current` UNCHANGED
    - `brewing_supplies_current` STILL decrements by 1 (failure costs the materials per Q4-d canon)
6. Empty supplies + click Brew Check button. **Expected:** button is disabled (canBrew gate). If somehow clicked: red "No brewing materials on hand" warning in the modal's warnings slot, roll button disabled.

## Manual smoke - Navigate Check

1. Vehicle in a campaign with map waypoints / pins. Click "🧭 Navigate Check" in the Navigator row.
2. **Expected:**
    - Title: "Navigate Check"
    - Pre-roll extras: skill dropdown defaulting to "Navigation (ACU · Skill +N)"
    - Caption: "Default is Navigation (ACU). Switch if the player has made a case for a different skill."
3. Pick a different skill (e.g., Survival). **Expected:** AMOD+SMOD chips auto-recompute to the new attribute/skill.
4. Roll. **Expected:** standard outcome banner. Feed row: "NAVIGATE &lt;navigator&gt; charts the route for &lt;vehicle&gt; ..."

## Manual smoke - Mounted Weapon Attack

1. Vehicle with `mounted_weapons` populated. Click the attack button next to a mounted weapon.
2. **Expected:**
    - Title: "&lt;weapon-name&gt; Attack"
    - Pre-roll extras: Target dropdown listing NPCs on the active tactical scene. Empty default option `-- Pick a target --`.
    - Each target option shows arc/range tags: `⛔ Out of arc` (disabled), `⚠ Out of range` (selectable but with soft warning).
3. Pick an in-arc, in-range target.
4. Roll a hit. **Expected:**
    - Outcome banner.
    - **Green badge**: "🎯 Hit on &lt;target&gt; · damage &lt;weapon-damage&gt; · &lt;rpPercent&gt;% RP"
    - Target NPC's `wp_current` / `rp_current` decremented per damage resolution.
    - Initiative-action decrement happens (mounted weapon consumes an action).
    - Feed row: "FIRE &lt;crew&gt; hits &lt;target&gt; using &lt;vehicle&gt;'s &lt;weapon&gt;" (with prefix-CAPS from earlier today's polish-batch commit `e72dd40`).
5. Roll a miss. **Expected:** Red badge "✗ Miss (&lt;target&gt; unhurt)".
6. Pick an out-of-arc target. **Expected:** Roll button disabled + ⛔ warning in the warnings slot.

---

## Edge case - GM has no AMOD/SMOD override

The previous bespoke modal let the GM edit AMOD and SMOD directly. The new modal does not - those fields are read-only chips.

- **Substitute path 1**: Brew Check, swap Mechanic*↔Tinkerer via the toggle to change the attribute/skill basis.
- **Substitute path 2**: Navigate Check, swap to a different skill via the dropdown.
- **Substitute path 3**: Attack, swap to a different mounted weapon (close + reopen on a different weapon).
- **Substitute path 4**: any check, swap to a different crew member (close + reopen with the new crew picker).
- **Fallback**: CMOD is still editable, GM can stack any tweak there.

If a GM raises that this is too restrictive, follow-up: add an "Advanced" toggle that reveals editable AMOD/SMOD inputs. Not in this commit.

---

## Console / network checks

- No new console errors compared to pre-migration.
- Network tab unchanged: 1× POST to `/rest/v1/roll_log` per roll, plus the same cascade writes (initiative_order decrement for attacks, brewing_supplies_current decrement for brew, vehicle fuel_current update for brew success, target NPC wp/rp update for attack hits).

---

## Rollback procedure

```sh
git -C /c/TheTapestry revert <vehicle-modal-commit> --no-edit
git -C /c/TheTapestry push origin main
```

State machine untouched, so revert returns to the bespoke modal cleanly.
