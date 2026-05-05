# BUG-3 Fix Test Plan — Mounted-weapon attacks consume actions

## What changed

- `lib/initiative-actions.ts` (new) — shared helper
  `decrementInitiativeAction()` that pure-DB-decrements
  actions_remaining on an initiative entry. Lives outside any
  page component so it's reachable from the popout vehicle page.
- `app/vehicle/page.tsx` — `rollCheck()` now calls the helper
  after the roll_log insert when `check.kind === 'attack'`. If the
  decrement reaches 0, broadcasts `turn_advance_requested` on the
  table's `initiative_${campaignId}` channel.
- `app/stories/[id]/table/page.tsx` — the initiative channel now
  listens for `turn_advance_requested` and runs `nextTurn()` +
  `loadInitiative(id)` on receipt.

## What did NOT change (intentionally)

- The table page's existing `consumeAction()` — left as-is. The new
  helper is a strict subset (no in-flight lock, no aim-clear, no
  nextTurn cascade), and refactoring `consumeAction` to use it
  carries regression risk for working flows. If `consumeAction`
  gets touched later for an unrelated reason, that's a fine moment
  to collapse them.
- Driving and Brew checks. Per the spec these are passive vehicle
  ops outside the combat-action economy. Only `kind === 'attack'`
  triggers a decrement.

## Pre-fix repro (to confirm the bug exists in main)

Skip if you trust the playtest dump — it already proved the bug.
Otherwise: with combat active, fire Minnie's M60 from the vehicle
popout. Observe `actions_remaining` on the active initiative entry
in the GM table. Pre-fix: it does NOT decrement. Player can fire
infinite times per turn.

## Post-fix smoke test (≤10 min)

Setup:
1. Open a campaign with combat active and at least one PC who is
   the active combatant.
2. PC must be assigned as the shooter on a vehicle's mounted
   weapon (Minnie's M60 is the canonical case).
3. PC's `actions_remaining` should start at 2.
4. Open the vehicle popout (`/vehicle?campaign=...`) AND the GM
   table side-by-side.

Test 1 — single attack decrements actions:
1. From the popout, click the M60's **Attack** button.
2. Pick any NPC target.
3. Click **Roll**.
4. ✓ Roll resolves, damage applies (on success).
5. ✓ Within ~1 sec, the GM table's initiative panel shows the
   PC's `actions_remaining` decrement from 2 → 1.
6. ✓ It's still the same PC's turn.

Test 2 — second attack triggers turn advance:
1. Without leaving the popout, click **Attack** on the same
   weapon again.
2. Pick any target. Roll.
3. ✓ Roll resolves.
4. ✓ Within ~1 sec, the GM table shows:
   - PC's `actions_remaining` = 0.
   - Active highlight moves to the next combatant in initiative
     order. Console on the table side shows
     `[nextTurn] called → activating: <name>`.
5. ✓ The console feed (chat side) shows the new active combatant.

Test 3 — driving check does NOT consume an action:
1. From the popout, run a **Driving** check.
2. ✓ Roll resolves and logs.
3. ✓ PC's `actions_remaining` stays where it was. (Driving is
   a passive op; only attacks cost actions.)

Test 4 — graceful degradation:
1. With combat NOT active, run an attack from the popout.
2. ✓ Roll resolves and logs damage normally.
3. ✓ No errors in the console. The decrement helper bails
   silently with `error: 'no active entry'`. (The popout shouldn't
   be doing combat attacks outside combat anyway, but this proves
   we don't crash.)

Test 5 — table-page `consumeAction` flows still work:
Smoke the existing combat flow to make sure nothing regressed:
1. Click Aim → ✓ actions decrements.
2. Click Defend → ✓ actions decrements.
3. Drag a PC token in combat → ✓ actions decrements.
4. Fire a regular ranged weapon (not mounted) → ✓ actions
   decrement, nextTurn fires when 0.

## What's NOT tested by this plan (left for later)

- Concurrent attacks from multiple vehicle popouts on the same
  PC. The helper has no in-flight lock; if two popouts somehow
  fire simultaneously you could double-decrement. In practice a
  PC only has one shooter assignment on one weapon at a time, so
  this is contrived. If it becomes real, lift consumeAction's
  `consumeActionInFlightRef` pattern into the helper.
- The `clearAim` behavior when consuming after a regular attack.
  Vehicle attacks don't use the aim system, so this isn't a path
  the helper needs to support.

## Rollback

If anything's wrong:
1. `git revert <sha>` — three-file commit, clean revert.
2. Or comment out the `if (check.kind === 'attack') { ... }` block
   in `rollCheck` (lines around 514–532 of `app/vehicle/page.tsx`)
   to disable the new path while keeping everything else intact.

## Bug doc cross-link

Resolves BUG-3 in [tasks/playtest-2026-05-04-bugs.md](playtest-2026-05-04-bugs.md).
BUG-1 (perception modal redundancy) and BUG-2 (sticky riders on
Minnie) are still pending.
