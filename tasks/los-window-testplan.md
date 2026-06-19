## Window LOS - Test Plan

**Root cause fixed:** two windows in The House scene were placed on *diagonal* wall segments. `splitOverlappingSegments` has an early return for diagonals (`!insHoriz && !insVert`), so the underlying wall was never split. At runtime, the unsplit wall blocked LOS even though the window was open.

**Fix:** `losBlocked` now computes the exact ray-wall intersection point (`lineIntersect`) and checks if any open window/door covers it (`pointOnSegment`). If yes, the block is cleared. This is a runtime safety net that handles diagonal walls and any future unsplit case.

---

1. Go to The House campaign and open the tactical map.
2. Make sure Vida Thane (or any PC) has a token placed inside the building.
3. As the GM, look at the exterior cells immediately outside the windows on the angled/corner walls (the two diagonal windows are in the upper portion of the building around grid coordinates x~20-25, y~16-18).
4. Confirm those exterior cells are now visible (not fogged black) from the PC's position.
5. As the player (Tony), confirm the same cells are visible on the player view - fog should lift outside the open windows.
6. Axis-aligned windows (the vertical ones on the left wall at x~11, and the right wall at x~33) should also still work correctly.
7. Closed a window (click it in Select mode to toggle closed - it turns from cyan to red-dashed). Confirm the cells outside that window fog back over immediately.
8. Re-open the window (click again). Confirm the cells outside clear again.
9. Interior cells (inside the building) should remain visible regardless.
10. Cells behind a solid wall (no window) should remain fogged.

Report back what you saw for each step.
