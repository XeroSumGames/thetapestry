# Parent/Child Pins — Testplan (2026-05-02)

Verifies that parent/child pin nesting on the world map is fully wired through Add, Edit, and View.

## Setup

1. Sign in (any role works — picker is owner-scoped)
2. Go to /map
3. You need at least one existing world pin in your account. If you don't have one, drop one first (double-click any spot, fill title, save).

## Tests

### A — QuickAdd modal: parent picker appears

1. Double-click an empty spot on /map to open Quick Add
2. Look between Category dropdown and Notes
3. **Expect:** "Parent Pin (optional)" dropdown is present with `— top-level (no parent) —` selected by default and your existing pins listed alphabetically below
4. Pick a parent, fill title (e.g. "Sub-rumor of X"), save

### B — Sidebar: child renders under parent with indent + ↳

1. Open the sidebar folder for the category you saved into
2. **Expect:** the new sub-pin appears directly below its parent, indented further right than the parent (50px vs 34px), with a `↳` glyph prefix

### C — Expanded view: breadcrumb back to parent

1. Click the sub-pin row to expand
2. **Expect:** the first line of the expanded body reads `Sub-pin of <parent title>` with the parent title rendered as an underlined link
3. Click the parent's title link
4. **Expect:** map flies to the parent pin and the parent expands

### D — Edit form: parent picker still works

1. Right-click an existing pin → Edit (or hit Edit from expanded view)
2. **Expect:** Parent Pin (optional) dropdown is present, current parent is selected
3. Change to a different parent, save
4. **Expect:** sidebar re-renders with the pin nested under the new parent

### E — Cycle prevention (existing, regression check)

1. Edit a pin that has children of its own
2. Open the Parent Pin dropdown
3. **Expect:** the pin's direct children do NOT appear as parent candidates (would form a 1-step cycle)

### F — Parent deletion → orphan, not cascade

1. Note the title of one of your sub-pins
2. Delete its parent pin
3. **Expect:** the sub-pin still exists, now rendered at top-level (no `↳` indent, no breadcrumb)

## Pass criteria

All six tests pass on production after deploy.
