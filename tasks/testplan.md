# Test Plan — Insight Dice Sequential Reroll

**Change:** A player who rerolls one die can now spend a second Insight Die to reroll the OTHER die. After the second spend (or after the "Both" option), they're locked out.

**Files touched:**
- `app/stories/[id]/table/page.tsx` — RollResult interface, initial roll setup, `spendInsightDie`, post-roll UI gate

**Precondition:** Character with ≥2 Insight Dice is in a campaign (any session, doesn't require active combat).

---

## 1. Baseline — no reroll
1. Open `/stories/[id]/table` as the player.
2. Roll a skill check (any 2d6 roll from the action bar).
3. **Expect:** Three buttons appear: `Re-roll Die 1`, `Re-roll Die 2`, `Re-roll Both (2)`.
4. Close the modal without spending.
5. **Expect:** Insight Dice count unchanged.

## 2. Single reroll on Die 1, then stop
1. Roll a skill check.
2. Click **Re-roll Die 1**.
3. **Expect:**
   - Die 1 shows a new value; Die 2 unchanged.
   - `Re-roll Die 1` button is GONE.
   - `Re-roll Die 2` button is STILL VISIBLE.
   - `Re-roll Both (2)` button is GONE.
4. Click **Done**.
5. **Expect:** Insight Dice count dropped by 1.

## 3. Single reroll on Die 2, then stop
Mirror of test 2 but with Die 2. After click, only `Re-roll Die 1` should remain visible.

## 4. Sequential: reroll Die 1, then Die 2
1. Roll a skill check.
2. Click **Re-roll Die 1**. Confirm only `Re-roll Die 2` remains.
3. Click **Re-roll Die 2**.
4. **Expect:**
   - Both dice show new values (Die 1 from step 2, Die 2 from step 3).
   - All reroll buttons GONE.
   - "Insight Dice spent" label shown.
5. Click **Done**.
6. **Expect:** Insight Dice count dropped by 2.

## 5. Sequential: reroll Die 2, then Die 1
Mirror of test 4. After both spends, "Insight Dice spent" shows.

## 6. "Both" button is one-shot
1. Roll a skill check.
2. Click **Re-roll Both (2)**.
3. **Expect:**
   - Both dice show new values.
   - All reroll buttons GONE.
   - "Insight Dice spent" label shown.
4. Insight Dice count dropped by 2.

## 7. Pre-roll spend locks out post-roll rerolls
1. Before rolling, spend an Insight Die to roll 3d6 (keep best 2).
2. After the roll resolves, check the modal.
3. **Expect:** NO reroll buttons shown. "Insight Die spent" label shown instead.

## 8. Insight Dice pool of exactly 1
1. Start with 1 Insight Die.
2. Roll a skill check.
3. **Expect:** `Re-roll Die 1` and `Re-roll Die 2` enabled, `Re-roll Both (2)` disabled/greyed.
4. Click **Re-roll Die 1**.
5. **Expect:** Panel disappears entirely (outer `myInsightDice > 0` gate hides it once the pool is empty).

## 9. High/Low Insight outcome hides reroll panel
1. Roll a natural 12 or natural 2.
2. **Expect:** Reroll panel not shown (outcome-based gate unchanged from before).

## 10. Damage re-applies on success flip (regression)
1. In combat, miss an attack (2d6 total below target number).
2. Click **Re-roll Die 1** and land a hit.
3. **Expect:** Damage applies to the target automatically, logged to Logs tab.
4. Roll another attack that misses, re-roll Die 1 and still miss, then re-roll Die 2 and now hit.
5. **Expect:** Damage applies on the second reroll that flipped to success.

---

## Smoke Checks
- Stress/Breaking Point rolls: no reroll panel (not a skill check) — unchanged behavior.
- Initiative rolls: no reroll panel — unchanged behavior.
- Roll log entries: post-reroll rows still appear with `is_reroll=true` metadata.
