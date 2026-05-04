# Tactical Vision — Phases 1+2 Testplan (2026-05-02)

Verifies GM-painted fog (Phase 1) and door behavior (Phase 2) on the tactical map.

## Setup

- Open a campaign you GM, switch to a story → Run Table.
- Make sure a tactical scene is active with a few PCs/NPCs placed.
- Have a second browser/tab logged in as a player viewing the same scene (for player-view tests).

## Phase 1 — GM-painted fog

### A — Fog editor opens

1. Look top-left of the canvas
2. **Expect:** "🌫️ Edit Fog" button is visible (GM only)
3. Click it
4. **Expect:** button row expands to Paint / Erase / Fog All / Clear All / Done

### B — Paint cells

1. Click "Paint", then drag across an area on the map
2. **Expect:** cells under the drag turn to a 35%-opacity dark overlay (GM view) with a thin purple outline showing patch boundaries

### C — Erase cells

1. Click "Erase", drag through previously fogged cells
2. **Expect:** those cells clear immediately

### D — Fog All / Clear All

1. Click "Fog All"
2. **Expect:** entire grid covers in fog
3. Click "Clear All"
4. **Expect:** all fog cleared

### E — Persistence + realtime

1. Paint a small region, click "Done"
2. Refresh the page
3. **Expect:** fog state survives the refresh
4. In the player tab: **Expect** the same fogged region appears as 92%-opacity black (much darker than GM view)

### F — Tokens in fog hidden from players

1. As GM, place an NPC in a fogged cell
2. **Expect (player tab):** NPC token does NOT render. Initiative tracker still shows the NPC by name (combat continuity)
3. As GM, the NPC still renders normally over the dimmed fog

### G — Realtime updates

1. With the player tab still open, GM paints a new fogged area
2. **Expect (player tab):** the new fog appears within ~1s without a refresh

## Phase 2 — Doors

### H — Door object renders distinct

1. As GM, open the Objects tab → Create object → pick the 🚪 Door icon → save
2. Place the door token on the map
3. **Expect:** door renders with a dashed green outline (open by default) + 🚪 emoji centered

### I — GM clicks toggle door

1. Click the door token (don't drag)
2. **Expect:** outline switches to solid red, fill goes from green-tinted to amber, the door now reads as "closed"
3. Click again
4. **Expect:** flips back to dashed green / open

### J — GM drag still moves the door

1. Drag the door to a new cell
2. **Expect:** door moves; door_open state is unchanged

### K — Closed door blocks movement

1. Position a closed door between a PC and an open cell beyond it
2. As that PC's player, try to Move into the closed-door cell
3. **Expect:** alert "That door is closed. Open it first or pick a different destination." Movement does not commit.

### L — Open door is passable

1. Click the door (as GM) to open it
2. As the player, Move into the open-door cell
3. **Expect:** PC token lands on the door cell, no alert

### M — Player click toggles door

1. As a non-GM player, click an open door
2. **Expect:** door closes (visual flip + the player's Move attempts now reject)
3. Player click again → door opens

### N — Realtime door updates

1. With player tab + GM tab both open
2. GM toggles the door
3. **Expect (player tab):** the door visual updates within ~1s

## Pass criteria

All 14 tests pass. Door open/close + fog paint/erase feel snappy (sub-100ms response on local network).
