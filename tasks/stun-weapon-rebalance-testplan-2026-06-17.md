# Stun Weapon Rebalance + PHY Fix - Verify Plan

**Commit:** `1c88383`
**Date:** 2026-06-17

## What changed

- TASER: rpPercent 400 -> 600 (now deals 6 RP, not 4)
- Cattle Prod: damageBase 2->1, rpPercent 400->200 (now deals 2 RP, not 8-16)
- Stun Gun: new Melee/Engaged weapon, 4 RP
- PHY no longer inflates RP on Melee stun weapons
- Stun weapons still deal 0 WP (existing behavior preserved)

## Verify steps

1. Open The Arena campaign table with active combat
2. Give a combatant (or use Knox) a Cattle Prod

**Cattle Prod - verify 2 RP, 0 WP:**
3. Attack an unarmored NPC with the Cattle Prod
4. Report: WP dealt to target, RP dealt to target
5. Expected: 0 WP, 2 RP (regardless of attacker PHY)

**TASER - verify 6 RP, 0 WP:**
6. Give a combatant a Taser (Ranged, needs Rare ammo)
7. Attack an unarmored NPC at Close range with the Taser
8. Report: WP dealt, RP dealt
9. Expected: 0 WP, 6 RP

**Stun Gun - verify it exists and deals 4 RP, 0 WP:**
10. Open a character's inventory, confirm Stun Gun appears in the Melee weapon list
11. Equip and attack with it
12. Report: WP dealt, RP dealt
13. Expected: 0 WP, 4 RP

**PHY does not inflate stun RP:**
14. Use Knox (PHY 2) with a Cattle Prod against an unarmored NPC
15. Report: RP dealt
16. Expected: exactly 2 RP (not 8 or 16 as in the bug)

**Stun weapons cannot kill:**
17. Reduce an NPC to RP 0 via Cattle Prod hits
18. Confirm the NPC is incapacitated
19. Hit the incapacitated NPC with the Cattle Prod again
20. Report: does WP decrease?
21. Expected: WP does NOT decrease - 0 WP dealt, stun weapons cannot kill

---

**Priority:** MEDIUM - verify before next playtest session.
**Routed by:** Puffer Fish (designed + fixed), 2026-06-17. Commit `1c88383`.
