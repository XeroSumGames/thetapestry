# Testplan — Initiative bar `×` button tooltip

**Commit:** `21529f7` (on main)

## What changed
The `×` button on each combatant in the initiative bar now has a context-sensitive `title` attribute. Behavior is unchanged.

- **GM viewing any combatant:** tooltip = `"Remove from combat"`
- **Player viewing their own active turn:** tooltip = `"End turn"`

## Why this was the right fix (not a relabel)

The button is dual-purpose by design ([page.tsx:5096-5121](app/stories/[id]/table/page.tsx:5096)):

- **GM click:** Removes that combatant from initiative. If the removed combatant was active, hands activity to the next combatant in roll-desc order (deliberately avoids `nextTurn()` to skip the "New Round" wrap).
- **Player click on own active turn:** Calls `nextTurn()` — ends their turn.

Both paths are sensible. The hole was discoverability — every other button in the row (Defer `↓`, Grant +1 `+`, status icons `💀🩸💤⚡`) had tooltips, the `×` didn't.

## Test steps

### As GM
1. Hard-refresh table during active combat.
2. Hover the `×` next to any combatant (active or not). Tooltip reads **"Remove from combat"**.
3. Click `×` on a non-active combatant → they vanish from the order. No turn change.
4. Click `×` on the *active* combatant → they vanish, the next combatant in roll-desc order becomes active. No "New Round" message in the feed.

### As Player
5. On your own turn (your row glows / `entry.is_active`), hover the `×`. Tooltip reads **"End turn"**.
6. Click → your turn ends; next combatant becomes active. (Same as the existing nextTurn flow.)
7. On *someone else's* turn, the `×` should not appear next to your row at all.

### Visual
8. Tooltip appears after the standard browser hover delay (~500 ms). No layout shift, no width change. Button position unchanged.

## Pass criteria
- Both GM and player see correct, distinct tooltips.
- All four click paths (GM-non-active, GM-active, player-own-turn, player-other-turn-hidden) behave identically to pre-change.
- No font-size guardrail regression: `node scripts/check-font-sizes.mjs` → OK.

## Rollback
Revert `21529f7`. Single-line change.
