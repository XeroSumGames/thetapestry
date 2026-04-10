# Test Plan: Region filter buttons (District Zero / Chased / Mongrels)

## 1. Start the dev server

```
npm run dev
```

Open the campaign map page that renders `MapView` (e.g. `http://localhost:3000/`).

## 2. Visual: button styling matches the chips above

1. Open the **Filters** sidebar (left rail).
2. Locate the bottom row: `DISTRICT ZERO (N)`, `CHASED (N)`, `MONGRELS (N)`.
3. Confirm each shows a count in parentheses (e.g. `MONGRELS (37)`) — same format as `CANON (19)` etc.
4. Confirm all three start **inactive** (grey border `#3a3a3a`, dark grey background `#242424`, muted text `#d4cfc9`).

## 3. Toggle behavior — single region

1. Click `MONGRELS`. Expect:
   - Button flips to active style (red border `#c0392b`, dark red background `#2a1210`, salmon text `#f5a89a`) — same as the active row 2 chips.
   - Map flies to the Mongrels area (lat 38, lng -112, zoom 5).
   - Sidebar pin list narrows to only pins whose lat is between 33–46 and lng is between -113.5 and -110.5.
2. Click `MONGRELS` again. Expect:
   - Button returns to inactive style.
   - Map does **not** fly anywhere on deactivation.
   - Sidebar pin list returns to whatever the chip filters above produce.

## 4. Toggle behavior — multiple regions (union)

1. Activate `DISTRICT ZERO` and `CHASED` together.
2. Sidebar list should now show pins from **both** regions (union), still intersected with whatever chips above are active.
3. Counts in `(N)` next to each region button do not change as you toggle — they always show the total number of pins in that region.

## 5. Interaction with existing chip filters

1. Activate `MINE` only in row 1 (deactivate `ALL` if needed) and activate `MONGRELS`.
2. Expect: only **your** pins inside the Mongrels bounding box appear in the sidebar.
3. Switch row 1 to `PUBLIC` only and keep `MONGRELS` on. Expect: only approved pins inside Mongrels.

## 6. Persistence (signed-in user)

1. Activate `CHASED`, refresh the page.
2. Expect: `CHASED` is still active after reload (persisted to `localStorage` under key `tapestry_pin_regions`).
3. Sign out / open as a Ghost (unauthenticated). Expect: regions reset to none and the timeline-only filter takes over as before.

## 7. Empty / out-of-bounds case

1. Activate all three region buttons.
2. The sidebar list should be the union of pins in District Zero + Chased + Mongrels bounding boxes only.
3. A pin you create in, say, Tokyo should **not** appear in the sidebar while any region is active.

## 8. Regression checks

- Row 1 chips (`SHOW`, `MINE`, `ALL`, `PUBLIC`) still toggle as before.
- Row 2 chips (`CANON`, `RUMORS`, `TIMELINE`) still toggle and persist as before.
- Sort: Date ⇄ A–Z still works.
- Pin search box still filters by title/notes/category.
- Map markers themselves are unaffected (existing behavior — chip + region filters only narrow the sidebar list).
