# Fix Verification: Charge "Cancel Move" clears the Charge

**Origin:** Session 24 playtest, 2026-06-16. Xero left two GM marks:
1. "charge when canceled is broken" (00:51:28 UTC)
2. "charge failed again - hit charge, hit cancel, still got the CHARGE modal and two moves" (01:01:45 UTC)

**Commit:** `550e252`

---

## Root cause (confirmed)

`page.tsx:6211` - the "Cancel Move" button onClick inlined `setMoveMode(null)` but did NOT clear `pendingChargeRef.current`. The Charge stayed live invisibly after cancel.

Flow that produced the bug:
1. Click "Charge" - sets `pendingChargeRef`, enters move mode
2. Click "Cancel Move" - ONLY clears `moveMode`; `pendingChargeRef` stays set
3. "Move" button reappears (normal-looking)
4. Click "Move" + click canvas - move fires; `onMoveComplete` sees `pendingChargeRef` still set - opens Charge attack roll modal
5. Cancel the attack modal
6. "Move" button appears again - click it + canvas - second move fires, costs 1 action

Fix: route "Cancel Move" to `handleMapMoveCancel()` (which clears `pendingChargeRef` + `sprintPendingRef` + `moveMode`) instead of inlining `setMoveMode(null)`.

---

## Verify steps (HP runs in live at thetapestry.distemperverse.com)

1. Open a campaign table with active combat (at least one combatant with 2 actions)
2. Activate a combatant that has a melee weapon (Charge needs one)
3. Click "Charge"
4. Confirm: button changes to "Cancel Move"
5. Click "Cancel Move"
6. Confirm: button changes back to "Move" - no attack roll modal appears
7. Click "Move", then click a map cell to complete a normal move
8. Confirm: a NORMAL move fires - NO Charge attack roll modal appears
9. Confirm: 1 action consumed (the normal Move cost), NOT 2

**Also test: Sprint cancel is not broken**
10. Activate a combatant with 2 actions
11. Click "Sprint"
12. Confirm: button changes to "Cancel Move"
13. Click "Cancel Move"
14. Confirm: button changes back to "Move" - no Sprint Athletics roll modal appears
15. Click "Move" (normal move)
16. Confirm: 1 action consumed for Move, no Sprint Athletics check

---

## What a successful Charge looks like (regression check)

17. Activate a combatant with 2 actions and a melee weapon
18. Click "Charge"
19. Click "Move" (or just click canvas without clicking "Cancel Move")
20. Click a map cell within 20ft
21. Confirm: Charge attack roll modal opens (NOT a normal move)
22. Roll or Cancel from the modal - should work normally

---

**Priority:** Blocker for combat reliability before Beta-500 dry-run (7/1).
**Routed by:** Puffer Fish (diagnosed + fixed), 2026-06-16. Commit `550e252`.
