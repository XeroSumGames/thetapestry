# Charge Cancel Fix - Verify Plan

**Commits:** `550e252` (route Cancel Move to handleMapMoveCancel) + `6d86456` (stale pendingChargeRef guard)
**Date:** 2026-06-17
**Session 24 marks:** "charge when canceled is broken" (00:51:28) / "charge failed again - hit charge, hit cancel, still got the CHARGE modal and two moves" (01:01:45)

## What changed

- `handleMapMoveComplete` now only honours `pendingChargeRef` when `moveMode?.feet === 20` (charge distance)
- If moveMode is 10ft (user switched to regular Move after Cancel), any stale charge ref is cleared and the move proceeds normally

## Verify steps

1. Open The Arena in active combat with a combatant who has 2 actions remaining

**Charge then Cancel (the failing scenario):**
2. When the combatant's turn starts, click "Charge"
3. Confirm the map highlights cells in green (charge move mode - 20 feet)
4. Click "Cancel Move" (the button label should change back to "Move")
5. Click "Move"
6. Click a valid destination cell on the map
7. Report: did the Charge roll modal appear?
8. Expected: NO charge modal. The token should simply move (regular Move, 1 action used).
9. Confirm: the combatant used 1 action (can still take another action this turn)

**Charge then use it (normal path still works):**
10. On a combatant with 2 actions, click "Charge"
11. WITHOUT clicking Cancel, click a valid destination cell
12. Report: did the Charge roll modal appear?
13. Expected: YES - the Charge roll modal should appear with the attacker's weapon

**Charge cancel then Move then another Move (should consume 2 total actions):**
14. On a combatant with 2 actions, click Charge, click Cancel Move, click Move, click destination (1st move)
15. Click Move again, click another destination (2nd move)
16. Report: turn ends after 2nd move?
17. Expected: YES - 2 regular moves use 2 actions, turn ends normally

---

**Priority:** HIGH - verify before next playtest session.
**Routed by:** Puffer Fish (dump analysis + fix), 2026-06-17. Commits `550e252` + `6d86456`.
