# Test Plan: Initiative Box in Logs Panel

## What Changed
- **GM side**: `startCombat` now calls `loadRolls(id)` after inserting initiative roll_log, so the initiative breakdown appears immediately in the Logs tab
- **Player side**: `combat_started` and `turn_changed` broadcast handlers now also call `loadRolls(id)`, so players see initiative entries without relying solely on the realtime postgres subscription
- **New round**: `nextTurn` new-round re-roll also calls `loadRolls(id)` so the updated initiative order appears in Logs

## Steps to Verify

### 1. GM sees initiative on combat start
- Start a session, then click **Start Combat**
- Switch to the **Logs** tab in the feed panel
- **Verify**: An orange-bordered "Initiative" box appears showing each combatant with their dice rolls, ACU, DEX, Drop, and total — sorted by initiative order

### 2. Player sees initiative on combat start
- Have a player connected to the table
- As GM, start combat
- **Verify**: The player's Logs tab shows the same initiative breakdown box without needing to refresh

### 3. New round re-roll shows in Logs
- Advance through all combatants until a new round triggers
- **Verify**: A new "New Round — Initiative" box appears in Logs with updated rolls
- **Verify**: Player also sees the new round initiative box

### 4. Both tab shows initiative
- Switch to the **Both** tab
- **Verify**: Initiative entries appear in chronological order alongside chat messages and other rolls
