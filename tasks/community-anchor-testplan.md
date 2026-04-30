# Test Plan — Communities Phase E #C: "Start near existing community" wizard tile

Shipped 2026-04-30. Closes the last actionable gap in the Phase E spec (#13 row 4) — gives a new GM a fourth start path beside Custom / Setting / Module, anchored to a community already living on the Tapestry.

## Pre-flight

No SQL migration this round — uses existing `world_communities`, `campaign_pins`, and `community_encounters` tables.

You'll need:
- At least one approved, published `world_communities` row owned by a DIFFERENT account than the test account (so it shows up in the picker — your own communities are filtered out).
- The test account logged in.

## Golden path

1. Open `/stories/new` as a non-Thriver test account.
2. Confirm the existing pickers render: Setting buttons, the optional Module picker, and (new) **"Or start near an existing community"** with the list of approved published communities you don't own.
3. Click one of the community cards.
4. **Expected**:
   - Card outlines blue (#7ab3d4) and shows community state.
   - Setting buttons all deselect (the row becomes inactive — none highlighted).
   - Module picker (if any) all deselect.
   - The Custom-setting Starting Location field hides.
5. Type a Story Name. Click **Create Story**.
6. **Expected**:
   - Campaign created with `setting='custom'` and `map_center_lat/lng` matching the community's homestead coords.
   - One `campaign_pins` row inserted: name `Near <Community Name>`, category `community`, lat/lng matching, sort_order 1.
   - One `community_encounters` row inserted: `world_community_id` = picked community, `encountering_campaign_id` = new campaign, `encountering_user_id` = test account, narrative `New campaign "<Story Name>" is starting near "<Community Name>".`
   - You're routed to `/stories/<new-id>`.
7. Open the story → world map → confirm the Homestead pin renders at the community's coords.

## Source GM gets the encounter handshake

1. Switch to the source GM account (the one that published the community).
2. Open the notifications bell.
3. **Expected**: a `community_encounter` notification fires with metadata pointing at the new campaign.
4. Click → confirm it routes correctly (existing flow).

## Mutual exclusion

1. On `/stories/new`, click a Setting button.
2. Now click a published-community card.
3. **Expected**: Setting button deselects; community card becomes the picked one.
4. Now click a Module (if any).
5. **Expected**: Community card deselects; Module becomes the picked one.
6. Click the same Community card again.
7. **Expected**: Module deselects; Community card becomes picked.
8. Click the same Community card a second time.
9. **Expected**: Card deselects (toggle off). No picker is selected — Story Name still allows Create, which would behave like Custom-setting with no starting location pinned.

## Self-filter

1. As the GM of an existing published community, open `/stories/new`.
2. **Expected**: your own community does NOT appear in the picker. (You shouldn't be able to start a campaign next to yourself.)

## Empty state

1. As any account on a fresh DB with no approved world_communities at all, open `/stories/new`.
2. **Expected**: the "Or start near an existing community" block does not render. Setting + Module pickers behave normally.

## Edge — picked community is later unpublished

1. Pick a community on `/stories/new`. Don't click Create yet.
2. Have a Thriver flip its `moderation_status` from approved to rejected via `/moderate`.
3. Click Create on the existing tab.
4. **Expected**: campaign creates regardless (we resolved the picked row at click-time). Homestead pin still seeds at the captured coords. The encounter handshake row still inserts but the trigger may notify based on a now-rejected community — this is acceptable. Subsequent reloads won't show the unpublished community in the picker.

## Regression — existing flows still work

Run a few:
- Create a campaign with **Custom** setting + a typed Starting Location → still works, lat/lng pinned to typed location, no community-anchored side effects.
- Create a campaign with a real Setting (e.g. Mongrels) → still seeds SETTING_PINS / SETTING_NPCS as before.
- Create a campaign with a Module → still clones via `cloneModuleIntoCampaign`, no community-anchored side effects.
