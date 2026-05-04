# Modules Phase 5C — Reviews + Featured — Testplan (2026-05-02)

Verifies that ratings & reviews are wired through the marketplace, detail page, RLS, aggregates trigger, and the featured-module surface on /campfire.

## Setup

You need:
- One published, **listed** module with at least one **active subscription** by a campaign you GM. If you don't have one, subscribe via /rumors/[id] → "Create campaign with this" first.
- Be logged in as the GM of that subscribing campaign.

## Tests

### A — Detail page: Reviews section appears for subscribers

1. Go to /rumors/[id] for the module you subscribe to
2. Scroll past the description
3. **Expect:** "Reviews" card is visible BEFORE Version History, with a "Write a review" form (5 star buttons + textarea + Submit button)

### B — Submit a 5-star review with body

1. Click 5 stars → label reads "5/5" in orange
2. Type a body: "Great encounter pacing — table loved it."
3. Click "Submit review"
4. **Expect:** form switches to "Edit your review", page re-renders with your review at the top of the public list, ⭐ chip appears in the title row showing 5.0 (1)

### C — Marketplace card chip + Highest rated sort

1. Go to /rumors
2. **Expect:** the module card shows ⭐ 5.0 (1) chip + 📥 chip on the bottom row
3. Open Sort dropdown → pick "Highest rated"
4. **Expect:** the rated module floats to the top; unreviewed modules sink to the bottom

### D — Edit and delete your review

1. Back on /rumors/[id], change rating to 3 stars, body to "Updated thoughts: still good but pacing dragged in scene 4."
2. Click "Update review"
3. **Expect:** ⭐ chip in title row reads 3.0 (1); your review in the list updates with the new body
4. Click "Delete" next to Update
5. Confirm prompt
6. **Expect:** ⭐ chip in title row disappears (rating_count back to 0), form clears, public list shows "No reviews yet"

### E — Non-subscriber CAN'T submit (RLS gate)

1. Log out, sign in as a different account that does NOT have an active subscription to this module
2. Go to /rumors/[id]
3. **Expect:** the "Write a review" form is HIDDEN entirely; only the public list shows (or "No reviews yet" + "Subscribers can leave reviews — pick a campaign with this module to write one.")

### F — Marketplace + detail page tolerate empty review state

1. Find a module with `rating_count = 0`
2. /rumors card: ⭐ chip should NOT render (only 📥 chip)
3. /rumors/[id]: title row has no ⭐ chip; Reviews section either hidden (non-subscriber) or shows write form + "No reviews yet"

### G — Featured module on /campfire portal

1. Go to /campfire (no `?tab=` — this triggers portal mode)
2. **Expect:** between "Setting Hubs" and "Explore the Campfire" sections, a single "Featured Module" hero card with cover image + module name + tagline + ⭐/📥 chips + "Open module →" link
3. Click the card
4. **Expect:** lands at /rumors/[id] for that module

### H — Featured surface gracefully empty

1. (Hard to test on prod with content) — if you ever clear all listed modules, the Featured Module section should disappear entirely from /campfire portal (graceful empty)

### I — Aggregate trigger consistency

1. After leaving 2+ reviews of varying ratings (using different test accounts that all subscribe), verify in the SQL editor:
   ```sql
   select avg_rating, rating_count from modules where id = '<module_id>';
   select avg(rating)::numeric(3,2), count(*) from module_reviews where module_id = '<module_id>';
   ```
2. **Expect:** the two queries return identical values

## Pass criteria

All nine tests pass. Aggregates always match between trigger-maintained columns and `module_reviews` ground truth.
