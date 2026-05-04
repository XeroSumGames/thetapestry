# Testplan — Skip-this-round button + GM-drag-burns-action fix

**Commits on main:**
- `230402d` — feat(initiative-bar): GM `⊘` Skip-this-round button
- `e7f611d` — fix(combat): GM drag of active combatant burns an action

## Part 1 — Skip-this-round (`⊘`) button

### What it does
GM-only amber `⊘` button on every combatant in the initiative bar with `actions_remaining > 0`. Click → zeroes their actions for the round (without removing them from `initiative_order`). They re-appear next round at full action budget.

- **Active combatant:** zeros their actions, then `nextTurn()` advances to the next combatant (or fires "New Round" if they were the last unacted).
- **Non-active combatant:** zeros their actions; the next `nextTurn()` walk skips them naturally.

### Test steps
1. Hard-refresh the table during active combat as the GM.
2. Confirm `⊘` appears (amber) on every combatant with actions left, between `+` and `×`.
3. Hover `⊘` → tooltip reads **"Skip this round (burn remaining actions)"**.
4. **Skip a non-active combatant.** Click `⊘` on Frankie when he is NOT active.
   - Frankie's row greys out (the existing `hasActed` styling at [page.tsx:4990](app/stories/[id]/table/page.tsx:4990)).
   - The active combatant doesn't change.
   - When the active combatant ends their turn (×, run out of actions, etc.), the turn-walk skips Frankie correctly.
5. **Skip the active combatant.** When Frankie IS active, click `⊘`.
   - Frankie's actions go to 0; row greys.
   - Activity hands off to the next combatant in the order.
   - If Frankie was the last unacted combatant, "New Round" fires (initiative reroll, all `actions_remaining` reset to 2).
6. **Cross-round persistence.** End the round, start the next. Frankie should be back in the order with `actions_remaining: 2` like everyone else.
7. **Player view.** As a non-GM player, the `⊘` button should NOT appear next to any combatant.
8. **No `⊘` when actions = 0.** After someone's already acted (actions_remaining=0), `⊘` should not show on their row.

## Part 2 — GM-drag-burns-action

### The bug being fixed
GM drags of an active NPC's token bypassed `consumeAction` entirely (the gate at [TacticalMap.tsx:1393](components/TacticalMap.tsx:1393) was `!isGM`). Frankie could be dragged across the whole map by the GM without his `actions_remaining` ever decrementing → round never advanced.

### The fix
GM drag of the token belonging to the *currently active* combatant now consumes 1 action via the new `onGMDragMove` callback. GM drag of an *off-turn* token is still free — that's intentional (cleanup / repositioning).

### Test steps
9. Start combat with Frankie (NPC) as a combatant.
10. Wait for Frankie's turn (or use Defer to make him active fast).
11. **GM drag, on-turn:** drag Frankie's token to a new cell. Verify:
    - Frankie's `actions_remaining` drops by 1 (visible in the initiative bar pip / count).
    - One drag = one action burned.
    - After two drags, `actions_remaining` is 0 and the turn auto-advances.
12. **GM drag, off-turn:** while it is NOT Frankie's turn, drag Frankie's token to a new cell. Verify:
    - No action consumed on Frankie's row.
    - No action consumed on the *currently active* combatant either.
    - Position updates and broadcasts as before.
13. **Player drag (regression):** a player drags their own PC token on their own turn. Should still consume 1 action exactly as before (`onPlayerDragMove` path unchanged).
14. **Player drag of someone else's token:** still blocked by the existing distance gate / RLS — no behavior change.

## Pass criteria
- `⊘` shows for GMs only, only on combatants with actions left.
- Skip works correctly for both active and non-active combatants, including the round-end "New Round" case.
- GM drag of active combatant burns exactly 1 action per drag.
- GM drag of off-turn combatants remains free.
- Player drag behavior unchanged.
- `node scripts/check-font-sizes.mjs` → OK.
- `npx tsc --noEmit` → clean.

## Rollback
Revert `e7f611d` (GM drag fix) and/or `230402d` (Skip button) independently if either fails. The two are unrelated changes in two different files; reverts won't conflict.
