# Test Plan — Inventory #1: Overencumbered Time-Tick

Shipped 2026-04-30. House-rule: every overencumbered PC + NPC loses 1 RP per hour over the limit until they rest or drop weight.

## Pre-flight

No SQL migration. Reuses existing `character_states.rp_current`, `campaign_npcs.rp_current`, and the established Stress/Incap auto-pipeline.

Setup: a campaign with at least one PC and one NPC. To get them overencumbered, give them inventory items totaling more than `6 + PHY` (use the GM Loot modal or the InventoryPanel directly).

## Golden path — single hour

1. Verify the test PC's InventoryPanel shows `OVERLOADED`. Note current RP.
2. Open GM Tools → **Time**.
3. **Expected**: modal opens with Hours = 1 and a list showing the overencumbered PCs + NPCs with `RP X → X-1`. PCs are blue-prefixed (PC ·), NPCs orange (NPC ·).
4. Click **Apply 1h to N**.
5. **Expected**: modal closes. The PC's RP dropped by 1 in their character sheet / live header. The roll feed shows `⏳ Time advances 1h · overencumbered: <names>`.
6. Open the InventoryPanel again — `OVERLOADED` still showing because nothing was dropped.

## Golden path — multi-hour

1. Open Time again. Set Hours = 3 with the +/- stepper (or type).
2. **Expected**: preview shows each affected character's RP dropping by 3 (clamped at 0).
3. Apply.
4. **Expected**: all RPs dropped by 3 (or to 0). Single roll-log entry summarizing.

## Edge — PC hits RP=0 (Incap)

1. Set up a PC at RP=2 and overencumbered.
2. Run Time with Hours=3.
3. **Expected**:
   - Preview row shows `RP 2 → 0 · INCAP` in red.
   - On Apply, the PC's `character_states` row gets:
     - `rp_current = 0`
     - `incap_rounds = max(1, 4 - PHY)`
     - `stress = min(5, prior + 1)`
   - The auto-stress pip from the existing Mortal/Incap rule fires (memory: `feedback_stress_on_mortal_incap.md`).
4. The roll feed entry still summarizes the time tick as one row.

## Edge — PC at WP=0 already (mortal)

1. Set up a PC at WP=0 (mortal) and RP=2 and overencumbered.
2. Run Time with Hours=3.
3. **Expected**: RP drops to 0 but `incap_rounds`/`stress` updates DON'T fire (mortal already takes precedence; the modal's WP-gate `wpCurrent > 0` skips the pipeline). PC's mortal countdown continues unchanged.

## Edge — NPC hits RP=0

1. NPC at RP=1 and overencumbered.
2. Run Time with Hours=2.
3. **Expected**: NPC RP=0. NPCs don't track Stress — no Stress write. The roster/sheet reflects the new RP.

## Edge — no one overencumbered

1. Make sure no one is overencumbered (drop items / give Backpack).
2. Open Time.
3. **Expected**: list shows "No one is overencumbered". Apply button is greyed out and reads "Nothing to apply".

## Edge — recovery (rest or drop)

1. Run Time on an overencumbered PC, deduct some RP.
2. The player drops items via InventoryPanel until OVERLOADED clears.
3. Run Time again.
4. **Expected**: that PC is no longer in the affected list. Other still-overencumbered characters tick as normal.

## Regression — non-RP modals untouched

1. Open Loot, CDP, Populate. All still work as before.
2. Combat damage to RP via the attack pipeline unchanged.
3. Existing OVERLOADED indicator on InventoryPanel + CharacterCard still renders.
