# Firing Arc Target Gate — Testplan (2026-05-03)

Verifies that the /vehicle Attack modal enforces firing-arc + range on
mounted-weapon shots, matching the cone visualizer on the tactical map.

## Setup

- A Mongrels campaign you GM
- Minnie placed on an active tactical scene with rotation set (e.g. 0° = forward up)
- At least 3 NPC tokens placed: one in front of Minnie within 100 cells, one behind Minnie, one in front but very far away (300+ cells)
- M60 weapon has a shooter assigned in the Mounted Weapons section

## Tests

### A — In-arc, in-range target

1. Click the M60's **🎯 Attack** button
2. **Expect:** target dropdown defaults to the front-and-close NPC, no chip, no banner
3. **Expect:** Roll button is enabled
4. Click Roll → roll fires, result shows

### B — Out-of-arc target chipped + Roll blocked

1. Re-open the Attack modal (close the previous result first)
2. In the dropdown, the NPC behind Minnie should be visible but **disabled** with " — ⛔ Out of arc" appended to the name
3. **Expect:** can't select it (browser greys it out)
4. Manually fiddle: rotate Minnie 180° so the NPC behind is now in front
5. Re-open Attack modal
6. **Expect:** that NPC is now selectable, no chip

### C — Out-of-range target chipped + Roll allowed

1. With Minnie facing the long-distance NPC (in front but >300 cells)
2. Open Attack modal
3. **Expect:** that NPC has " — ⚠ Out of range" suffix, but is still selectable
4. Pick it
5. **Expect:** an amber banner appears: "Beyond this weapon's primary range band. Roll allowed but the GM may apply a Range CMod."
6. **Expect:** Roll button stays enabled
7. Click Roll → roll fires (the GM can adjust CMod before clicking)

### D — Weapons without arc data skip the gate

1. Add a vehicle whose mounted weapon has NO mount_angle or arc_degrees (or use an existing pre-backfill vehicle)
2. Open its Attack modal
3. **Expect:** target dropdown is plain — no chips, no banners, every target selectable
4. Roll button is gated only by "target picked" (the original behavior)

### E — Default target picks first in-arc

1. With multiple NPCs (mix of in-arc and behind-vehicle)
2. Open Attack modal
3. **Expect:** the dropdown defaults to a NON-blocked target (alphabetical first in-arc, in-range)
4. NOT the first alphabetical overall if that one happens to be behind the vehicle

### F — Tactical map cone agreement

1. Toggle the cone overlay on the map (🎯 button on Minnie's selected-token panel)
2. Visually identify which NPCs sit inside the cone
3. Open the Attack modal
4. **Expect:** every NPC inside the visible cone is selectable (not ⛔)
5. Every NPC outside the visible cone is ⛔

## Pass criteria

All six tests pass. Cone overlay and Attack modal agree on which targets are valid; out-of-arc shots are hard-blocked; out-of-range shots are soft-warned.
