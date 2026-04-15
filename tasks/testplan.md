# Test Plan: Range Enforcement + Unarmed Attack + Move Mode + Token Visuals

## Changes Made
- Range circle shows longest-range weapon from all equipment
- Auto range band calculation from token grid positions
- "Out of range" blocks Roll button when weapon can't reach target
- Unarmed Attack button on action bar
- Move mode with green highlighted cells
- Mortal wound red X on tokens, dead tokens at 50% opacity
- NPC cards show all weapons as attack buttons
- GM Notes share with players
- NotificationBell on table page
- Start Combat auto-shares tactical map
- NPC cards draggable during combat
- Session join race condition fix

## Test Steps

### Range Circle
1. Place a PC with an Assault Rifle on the tactical map
2. Click their token
3. **Expected**: Outer red circle shows "Long (60ft)", not "Close (15ft)"

### Auto Range Band
1. Start combat with tokens on the tactical map
2. Click Attack on the action bar
3. Select a target in the roll modal
4. **Expected**: Range band auto-selects based on grid distance between tokens
5. Move tokens closer/further and reselect target — range band should update

### Out of Range
1. With Unarmed selected, pick a target 5+ cells away
2. **Expected**: "Out of range" message, Roll button disabled
3. With Assault Rifle, pick same target
4. **Expected**: Roll button enabled (Long range covers it)

### Unarmed Attack Button
1. Start combat, active combatant's turn
2. **Expected**: "Unarmed" button visible between Aim and Attack
3. Click Unarmed — roll modal opens with damage 1d3, PHY attribute

### Move Mode
1. Click Move on action bar
2. **Expected**: Green highlighted cells around active token (3 cells at 3ft/cell)
3. Click a highlighted cell — token moves, action consumed
4. Click Move again — **Expected**: "Cancel Move" shown, clicking cancels
5. Press Escape during move mode — cancels without consuming action

### Token Death Visuals
1. Reduce an NPC to 0 WP (mortal wound)
2. **Expected**: Bright red X over their token on the tactical map
3. Let death countdown expire (or set to dead)
4. **Expected**: Token at 50% opacity with red X
