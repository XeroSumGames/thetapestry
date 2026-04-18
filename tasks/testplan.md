# Test Plan — Tactical Map: Sticky-Drag Fix + Attack Roll Auto-Target

## Part 1: Sticky mouse after clicking a token

### Setup
- [ ] Open a campaign with a tactical scene and at least one token
- [ ] Launch the table: `npm run dev` then navigate to `/stories/[id]/table`

### Step 1: Single click on own token (GM)
- [ ] Log in as GM
- [ ] On the tactical map, click ONCE on a token (mousedown + mouseup in place, no drag)
- [ ] Move the mouse around the canvas
- [ ] **Expected:** token stays at its grid cell; the cursor is no longer "grabbing"; nothing follows the mouse
- [ ] **Fail case (before fix):** token floats with the cursor until next click

### Step 2: Real drag still works
- [ ] Click-and-drag the token to a new cell
- [ ] Release on a different cell
- [ ] **Expected:** token snaps to new cell with ease-out animation; other clients see it move within ~1s

### Step 3: Drag outside grid
- [ ] Click-drag a token and release the mouse OUTSIDE the canvas
- [ ] Return the cursor to the canvas
- [ ] **Expected:** token is back at its original cell; drag state cleared; no sticky cursor

### Step 4: Player drags own token
- [ ] Log in as a player whose character has a token
- [ ] Single-click own token → not sticky
- [ ] Drag own token to a new cell → moves and syncs to GM
- [ ] Single-click an NPC/other token → selects (shows info panel) but not sticky

### Step 5: DB write failure does not orphan drag
- [ ] (Optional) Throttle DevTools network to "Offline"
- [ ] Drag a token to a new cell
- [ ] **Expected:** drag state still clears; warning appears in console (`[TacticalMap] token move failed:`); token reverts to last known cell on next refresh

## Part 2: Attack Roll auto-populate last target

### Setup
- [ ] Active combat with at least one character + 2 NPC targets
- [ ] Complete one turn where you attack Target A

### Step 6: Next turn — same character
- [ ] On your next turn, open the Attack Roll modal
- [ ] **Expected:** the Target dropdown is pre-populated with "Target A" (the last target hit this round)
- [ ] You can still change the target via the dropdown

### Step 7: New round clears memory
- [ ] Advance to a new round
- [ ] Open the Attack Roll modal
- [ ] **Expected:** Target dropdown is empty / default (no stale target from previous round)

### Step 8: Character who hasn't attacked yet
- [ ] Switch to a character who has not attacked this round
- [ ] Open Attack Roll modal
- [ ] **Expected:** Target dropdown is empty / default
