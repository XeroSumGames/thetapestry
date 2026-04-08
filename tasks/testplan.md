# Show/Hide All Pins Button — Test Plan

## What changed
Added a "Hide All" / "Show All" toggle button in the Pins sidebar header that removes or restores all pin markers on the map.

## Steps to test
1. Navigate to the **Map** page with the Pins sidebar open
2. Verify a **"Hide All"** button appears in the header row, next to the "Filters" label
3. Click **"Hide All"** — verify:
   - All pin markers/clusters disappear from the map
   - The button text changes to **"Show All"**
   - The pin list in the sidebar remains visible (only map markers are hidden)
4. Click **"Show All"** — verify:
   - All pin markers/clusters reappear on the map
   - The button text changes back to **"Hide All"**
5. Toggle a few times to confirm it's stable
6. While pins are hidden, try using filters/search in the sidebar — verify the sidebar list still filters correctly
7. Click "Show All" after filtering — verify only the filtered pins' markers reappear (note: currently all markers show/hide together via the cluster group)
