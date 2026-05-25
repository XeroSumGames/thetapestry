# Test plan - fog toolbar two-line layout

Date: 2026-05-25
Lane: Hunt & Peck
File: components/TacticalMap.tsx (GM fog/lighting toolbar)

## What changed
The EXPANDED fog toolbar (Edit Fog mode) was one long, busy row. It now wraps
into two rows (per Xero 2026-05-25):
- **Line 1:** Day/Night, Paint, Rect, Rect-Erase, Erase, Select
- **Line 2:** Wall, Wall Rect, Door, Window, Fog All, Clear All, Done
  (plus the "right-click to delete / Clear Walls" hint when a structure tool is active)

The drag handle (and the reset arrow when moved) lead line 1; Done trails line 2.
The collapsed toolbar (Day/Night + Edit Fog) stays a single small row.

Two judgment calls I made (say the word to move them):
- **Paint** wasn't in your line-1 list but it's a fog tool, so I put it on line 1
  with Rect/Rect-Erase/Erase. (Didn't drop it - that would lose the basic paint tool.)
- **Done** wasn't assigned a line; I trailed it on line 2.

## Steps (live - thetapestry.distemperverse.com, as GM)
1. Open a tactical scene, click 🌫️ Edit Fog.
2. CONFIRM the toolbar shows TWO rows:
   - Row 1: 🌞/🌙 Day/Night | Paint | Rect | Rect-Erase | Erase | ↖ Select
   - Row 2: 🧱 Wall | ⬛ Wall Rect | 🚪 Door | 🪟 Window | Fog All | Clear All | Done
3. CONFIRM it reads less cramped than before (no single wide row).
4. Click 🧱 Wall (or Door/Window). CONFIRM the "⌫ Right-click to delete" hint +
   "Clear Walls" button appear on row 2 and the toolbar still looks tidy.
5. Click ↖ Select, then click a wall segment. CONFIRM the selected-segment action
   panel appears BELOW the two-row toolbar (not overlapping row 2).
6. Click Done. CONFIRM the toolbar collapses back to the single small row
   (Day/Night + Edit Fog).
7. Drag the toolbar by ⠿ and drop it. CONFIRM both rows move together and it
   still centers/resets correctly (↺).

## Automated
- `npx tsc --noEmit` clean; check-arch / font / role / em-dash green.
