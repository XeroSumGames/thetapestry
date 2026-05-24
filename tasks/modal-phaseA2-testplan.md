# Modal Redesign - Phase A2 testplan (2026-05-24)

Shipped: commit `647f28e`. Component-only change to `components/RollModal.tsx` (the shared shell behind all 8 non-combat roll modals). Run on the deployed dev env at `thetapestry.distemperverse.com` after the build lands.

Rollback if wrong: `git revert 647f28e --no-edit && git push origin main`.

## What changed (so you know what to look for)
- The shared roll modal is now **340px** wide (was 400).
- **CMod is a compact box on the base-roll line** (`2d6  +AMod  +SMod   CMod[box]`), pushed to the right. The old full-width "Conditional Modifier" label + input is gone.
- **Three-zone layout:** title/base-roll on top, a **variable middle strip** that reserves ~70px even when empty, then Insight + Cancel/Roll at the bottom. So modals with a blank middle (Stabilize) are the same length as ones with a dropdown (Distract).
- **Pre-roll extras moved below the base-roll line** (Distract's `2d6` now sits above its target dropdown).

This is the shipped Phase-A component reworked - the combat ATTACK modal is NOT touched yet (that's Phase C), so expect ATTACK to still look like its old self until then.

## Check on each of the 8 roll modals
Trigger each (same as the Phase A sheet) and confirm:
1. **Width is 340** (narrower than before) and the panel still drags.
2. **CMod box** sits inline on the `2d6 ...` line, right-aligned, just wide enough for a value like `-3`. Typing in it still changes the roll's CMod.
3. **Three-zone length is consistent:** Stabilize (blank middle) and Distract (target dropdown in the middle) should be about the **same height**; the Cancel/Roll buttons sit at the bottom of both.
4. **Distract / Gut Instinct:** the target / sub-skill dropdown renders in the middle, **below** the `2d6` line (not above).
5. **Stress Check:** the warning line renders in the middle.
6. **Recruit (result step):** dice + outcome + join/fail card still render (result-only modal; no base-roll line).
7. **Breaking Point / Lasting Wound:** the check rolls; table outcome renders; no reroll buttons.
8. **Post-roll (any):** 52px dice, blue Success, green "+1 Insight Die" pill + reroll buttons all still work.

## Known NOT-done-yet (do not flag as bugs)
- ATTACK combat modal unchanged (Phase C).
- Insight still shows whenever the roller has dice; the **no-insight carve-out on Stress / Breaking Point / Lasting Wound is Phase A3** (not in this commit).
- Gut Instinct still uses its current sub-skill logic; the player-picks **dropdown is Phase A3**.
- Recruit is still its current pick step; the **wide shell-chrome form is Phase A3**.
- The 4 content-heavy / 13 non-roll modals are Phase E.

## Gates (already passed at build)
tsc, font/role/em-dash/arch, 586 unit tests. No caller changes, so no behavior change to roll resolution - this is chrome only.
