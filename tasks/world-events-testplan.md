# Test Plan — Communities Phase E #1: World Event CMod propagation

Shipped 2026-04-30. Spec: [tasks/spec-communities.md](spec-communities.md) §13 #1.

## Pre-flight

1. Apply the migration in Supabase SQL editor:
   - Run [sql/map-pins-world-event-cmod.sql](../sql/map-pins-world-event-cmod.sql).
   - Verify with: `SELECT column_name FROM information_schema.columns WHERE table_name = 'map_pins' AND column_name LIKE 'cmod%';` — should return 4 rows.

2. Confirm at least one published community exists with a Homestead pin attached. The Mongrels community in The Arena campaign is a good candidate. If the community has no Homestead pin, World Events can't reach it and this test plan won't trigger anything.

## Golden path — Plague applies a CMod

1. Open `/map`, find or create a timeline pin near the community's Homestead. Easiest: click the pin location in roughly the same region (within ~500 km) as the Homestead.
2. Edit that pin. Tick its **Distemper Timeline** category if not already.
3. Scroll to the new **World Event** block:
   - ✅ Tick **currently active**.
   - **CMod Impact**: enter `-2`.
   - **Radius (km)**: leave blank (defaults to 500) or enter `1000`.
   - **CMod Label**: enter `Plague — Test`.
4. Save.
5. Open the campaign's table view → Communities panel → run **Weekly Morale Check** on a community whose Homestead is inside that radius.
6. **Expected**: a new **World Events** row appears in the modal, just above Additional. Inside it: one labeled checkbox `Plague — Test ... <distance> km · −2`, ticked by default. The slot total reads `−2`. The pre-roll CMod preview at the bottom of the modal includes the −2.
7. Click **Run Weekly Check**. The result page shows `World Events −2` in the slot breakdown alongside Mood / Fed / Clothed / etc.
8. **Expected DB**: `community_morale_checks.modifiers_json` for that row contains `worldEvents: -2` and a `worldEventsDetail` array with `applied: true`.

## Edge — opt-out per event

1. Re-open the Weekly Morale Check (same community).
2. **Untick** the Plague event in the World Events row.
3. **Expected**: slot total flips to `0`. Pre-roll preview drops back by 2.
4. Run the check. `modifiers_json.worldEvents` is `0` and `worldEventsDetail[0].applied` is `false`.

## Edge — out-of-radius community

1. Create a second community with a Homestead pin far away (say, 2000+ km from the Plague pin).
2. Run a Weekly Morale Check on that community.
3. **Expected**: the World Events row does NOT render (no events inside the radius). Behavior matches pre-Phase-E for this check.

## Edge — multiple stacking events

1. Create a second active world event near the same community: `+1` impact, label `Relief Shipment`, 500 km radius.
2. Open the Weekly Morale Check on the affected community.
3. **Expected**: World Events row shows BOTH events. Slot total is `−1` (Plague −2 + Relief +1). Both checkboxes default to ticked.

## Edge — narrative-only event

1. Edit a timeline pin. Tick **currently active** but leave **CMod Impact** blank.
2. **Expected**: even with active=true, the event does NOT appear in any community's Morale modal. Narrative-only events stay narrative.

## Edge — event toggled inactive

1. Edit the Plague pin. Untick **currently active** (leave Impact at −2).
2. **Expected**: the event drops out of the World Events row on subsequent Weekly Morale Checks across every affected community.

## Edge — community with no Homestead

1. Find / create a community with no Homestead pin assigned.
2. Run its Weekly Morale Check.
3. **Expected**: World Events row never renders (we can't compute distance without coords). No errors in the console.

## Regression — old slots still work

For any of the runs above, also confirm:
- Mood, Fed, Clothed, Enough Hands, Clear Voice, Safety, Additional — all behave as before.
- Result-stage slot breakdown still shows all six original slots.
- Departure %, Retention Check, dissolution flow — all unchanged.
