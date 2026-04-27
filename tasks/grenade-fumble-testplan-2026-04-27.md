# Grenade Fumble Test Plan

## Rules
- **Success / Wild Success / High Insight (6+6)**: clean throw — grenade detonates at intended cell. *(unchanged behavior)*
- **Failure (4-8)**: wild throw — scatter 1d8 direction × 1d4 cells from intended cell.
- **Dire Failure (≤3)**: bad wild throw — scatter 1d8 direction × 2d4 cells.
- **Moment of Low Insight (1+1)**: grenade detonates in thrower's hand. Blast resolves centered on thrower's tile (they catch full Engaged).

Once the grenade is thrown, ammo is consumed regardless of outcome (you can't un-pull a pin).

## Setup
1. Active campaign, tactical map, GM as one PC plus another PC nearby (2–3 cells).
2. Equip a Grenade on the active PC (clip=1).
3. Pick a target cell at Close range (within 30 ft of the thrower).

## Scenarios

### A. Clean throw baseline (regression check)
- Roll a normal Success (e.g. force a roll that totals 9–13).
- Confirm grenade lands at intended cell.
- Confirm expanded log entry has the existing `Blast Radius — Engaged: X WP | Close: Y WP` and `Blast hit: ...` lines.
- Should be identical to pre-change behavior.

### B. Failure → 1d4 cell scatter
- Roll a Failure (4–8).
- Expanded log entry should now contain a new line **above** the Blast Radius header:
  `🎲 Wild throw — scattered <DIR> N cell(s) (M ft). Impact: (X,Y).`
- The `Blast hit:` list should reflect tokens within Engaged/Close of the *new* `(X,Y)`, not the originally-targeted cell.
- The named target (if any) should NOT take damage — only blast splash victims.
- Roll several times to confirm direction varies (8 compass points) and distance stays in 1–4.

### C. Dire Failure → 2d4 cell scatter
- Roll a Dire Failure (3 or less; e.g. forcing 1+2).
- Same as B but log line reads `⚠️ Dire Failure — scattered <DIR> N cells (M ft)`.
- Distance should be 2–8 cells (2d4 range).

### D. Moment of Low Insight → detonates in hand
- Roll snake-eyes (1+1).
- Expanded log entry has `💥 Moment of Low Insight — grenade detonates in hand at thrower's cell (X,Y).`
- Blast hits should include the **thrower** at Engaged (full WP) plus any allies within 5 ft (Engaged) or 30 ft (Close at half).
- This is intentionally brutal — verify the thrower's HP drops and any nearby allies catch splash.

### E. Edge: scatter off map edge
- Throw a grenade near the map's top-left corner (e.g. cell (2,2)) and force a Dire Failure with NW direction + max 2d4 distance.
- Expected: impact cell clamps at (1,1) (no negative coords). Blast resolves there. AoE may hit fewer tokens than usual since the impact is in a corner — that's correct (the blast radius extends off-map, so anything beyond the corner just doesn't get hit).

### F. Edge: grenade thrown at a token target (not a cell)
- Click a hostile NPC token directly (instead of a cell) for the grenade target.
- Force a Failure.
- Confirm scatter computes from the *token's* current grid position (not from a synthetic cell).
- Expected log line shows the new (X,Y) and that token may or may not be hit by the resulting splash depending on direction.

### G. Edge: thrower has no map token
- Outside combat, with a PC who isn't on the tactical map, force a Low Insight.
- Expected: log says `Moment of Low Insight — grenade detonates, but the thrower has no map token, so no AoE applied.`
- No damage applied anywhere. Ammo still decrements.

## Visual / log expectations
The expanded log entry on a fumble looks like this (compare against the existing screenshot for clean throws):

```
[OUTCOME: Failure]
[base roll details]
🎲 Wild throw — scattered NE 3 cells (9 ft). Impact: (12,7).
Blast Radius — Engaged: 14 WP | Close: 7 WP
Blast hit: Frank "Frankie" Wallace (Close): 7 WP, 7 RP | Kincaid's Soldier #4 (Engaged): 14 WP, 14 RP
```

The wild-throw line slots in BEFORE the existing Blast Radius header (chronological order: throw landed → blast happened).
