# Testplan — Stabilize multi-target picker

## What changed

Today's `🩸 Stabilize <Name>` button on the combat actions row uses `entries.find(...)` + `campaignNpcs.find(...)`, so when multiple combatants are bleeding out simultaneously the GM sees only the first one each query happens to return. With Cree, Marv, and an NPC all at WP=0 in the same round, you'd see one button and have no way to direct the medic.

Now: `find` → `filter`. Every mortally-wounded combatant within 20ft of the active combatant gets its own button. Each button keeps its own engaged check (warns if > 5ft, errors-on-click), its own roll label (`Stabilize <Name>`), and consumes one action when clicked. The single-target case still renders as a single button — same visual as before.

Implementation lives in `app/stories/[id]/table/page.tsx` ~line 5757. No SQL, no schema, no behavior change for single-target cases.

## Test cases

### Setup
- Campaign with at least 2 PCs and 1 NPC, all in initiative on the same scene.
- Active combatant has Medicine and is within 20ft of all three (otherwise targets get filtered out — that's the intended range gate, not a bug).

### 1. Single bleeding-out target — no regression
1. Damage one PC to WP=0 (`death_countdown` set, not yet 0).
2. Active combatant is the medic.

**Expected:** One `🩸 Stabilize <PC name>` button — same as today's behavior.

### 2. Two bleeding-out targets — picker mode
1. Damage two PCs to WP=0 in the same round.
2. Active combatant is the medic.

**Expected:** Two stacked buttons — `🩸 Stabilize <PC1>`, `🩸 Stabilize <PC2>`. Click either; only that target's stabilize roll fires; one action consumed.

### 3. PC + NPC both mortally wounded
1. PC and NPC both at WP=0, both in range, both with `death_countdown > 0`.

**Expected:** Two buttons — one PC, one NPC. Verify the NPC button stabilizes the NPC (`death_countdown` clears, `incap_rounds` set on the NPC, log line says `<medic> Stabilizes <NPC>`).

### 4. Out-of-range targets filtered
1. Three bleeding-out PCs: one at 4ft (engaged), one at 18ft (in range, not engaged), one at 25ft (out of range).

**Expected:** Two buttons rendered — for the 4ft PC (green, engaged) and the 18ft PC (yellow, "(not engaged)"). The 25ft PC is filtered out completely (button absent). Clicking the 18ft button shows the "must be engaged" alert.

### 5. No-map fallback
1. Bleeding-out PC, no active tactical scene (or active combatant has no token).

**Expected:** Button still renders (distFeet=null falls through the range filter). Mirrors today's behavior — the GM can stabilize verbally without a map.

### 6. Already-dead PC excluded
1. Three combatants: alive PC, mortally-wounded PC (WP=0, dc=2), dead PC (WP=0, dc=0).

**Expected:** Only the dc=2 PC has a button. Dead PCs are excluded by the `(dc == null || dc > 0)` gate.

### 7. Action consumption is per-click, not per-target
1. Two bleeding-out targets, medic has 2 actions.
2. Click `Stabilize <Target A>` → roll modal opens, complete roll. Verify medic's `actions_remaining` ticks 2 → 1.
3. With 1 action left, both stabilize buttons should still appear (assuming nothing else changed). Click `Stabilize <Target B>` → second roll, action ticks 1 → 0.

**Expected:** Each click costs one action. The targets-filter doesn't auto-burn actions for skipped targets.

## Watch for

- Render hygiene: each button has a stable React key (`stab_<kind>_<id>`); no duplicate-key console warnings even when targets shift between renders.
- The "must be engaged" alert names the correct target, not the active combatant.
- Roll log entries read `<medic> Stabilizes <target name>` (the existing parser at line 282–286 reads `Stabilize <name>` from the label suffix; multi-button doesn't change the label shape).

## Limitations / known gaps

- No "Stabilize all" bulk button — that would be a different feature (multiple actions consumed, multiple rolls). Out of scope.
- Range gate uses 8-direction Chebyshev distance (existing `Math.max(|dx|, |dy|)`), same as the rest of the table. Diagonal counted as 1 cell; no Pythagorean math added.
