# Vehicle Damage Logging - Test Plan (2026-05-28)

Shipped in `cc85742` (live on Vercel). Two pieces, both on the `/vehicle` popout:

1. **Apply-Damage field** - one logged "took N damage" line instead of silent -1 clicks.
2. **Damage-table effect** - the 2d6 system roll now shows its effect text in the feed.

Test against **Minnie** (campaign with the Mongrels' bus - she's the only vehicle with a damage table). Open her vehicle popout as the GM. You also want the table page's roll feed open (a second tab/window) to watch the entries land.

---

## Part 1 - Apply Damage field

The Apply-Damage control sits in the **Wound Points** row of the vehicle card, to the right: a small number box (placeholder "dmg") + an **Apply** button, then the existing **-1** / **+1** buttons.

1. Note Minnie's current WP (e.g. 67 / 67).
2. Type `7` in the dmg box, press **Apply** (or hit **Enter** in the box).
   - **Expect:** WP drops by 7 (67 -> 60). The box clears.
   - **Expect in the feed:** one red row - **💥 Minnie took 7 damage**.
3. Type `5`, press Enter this time (instead of clicking Apply).
   - **Expect:** WP drops another 5 (60 -> 55), feed shows **💥 Minnie took 5 damage**.
4. Edge - over-kill: set the box to a number bigger than current WP (e.g. `999`), Apply.
   - **Expect:** WP clamps at **0** (never negative), feed shows "Minnie took 999 damage".
5. Edge - garbage input: try `0`, then empty, then `-3`, then letters. Apply each.
   - **Expect:** nothing happens (no WP change, no feed line). Only a positive whole number does anything.
6. The old **-1 / +1** buttons should still work as silent nudges (no feed line) - they're for corrections, not damage events.

## Part 2 - Damage Table effect in the feed

Below WP is the **Damage Table** card (the 2d6 "which system got hit" roller).

7. Press **Roll 2d6** on the damage table.
   - **Expect in the feed:** an amber row headed **🔧 VEHICLE DAMAGE**, with the **system in bold** (e.g. "Minnie took damage to the Engine - seized") and the **effect text** beneath it.
8. If the effect text is long (most are), it should be **truncated with a ... and a ▸ toggle** on the right of the row. Click ▸.
   - **Expect:** the full effect text expands; ▾ collapses it again.
9. Roll a few more times to see different systems (effects vary by roll). Short effects (e.g. the "Body damage only" cosmetic one) should show in full with no toggle.

## Part 3 - the intended GM flow end-to-end

10. Simulate a hit: Apply the damage amount (Part 1), THEN Roll 2d6 (Part 2).
    - **Expect:** two clean feed lines in order - "💥 Minnie took N damage" then "🔧 VEHICLE DAMAGE - <system> + effect". That's the two-entry record you asked for.

## Part 4 - player view (optional)

11. As a **player** (non-GM) on the same campaign, open Minnie's popout.
    - **Expect:** NO Apply-Damage field / no -1/+1 (those are `canEdit`/GM-only). The feed lines from the GM's actions should still appear in the player's roll feed.

---

## Automated coverage (already green)

- `tests/lib/vehicle-damage.test.ts` - 4 new unit tests on `buildVehicleDamageLog` (WP subtract, clamp-at-zero, string coercion, reject non-positive/non-numeric). Full suite 711/711.
- Canvas/pixel + the live feed rendering are **manual** (this plan) - Vitest can't see the popout.

## If something's off

- Field does nothing: confirm you're the GM (canEdit) and on Minnie specifically.
- No effect text on the table roll: hard-refresh (new deploy) - the render case is new in this build.
- Negative WP or a missing feed line on valid input: that's a real bug, tell me the input + what happened.
