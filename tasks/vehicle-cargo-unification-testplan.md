# Test Plan — Inventory #3: Vehicle Cargo Unification

Shipped 2026-04-30. Vehicle cargo now uses the same `InventoryItem` shape as PCs and NPCs, with tolerant reads for legacy rows. Vehicle encumbrance now reflects current cargo total vs. the vehicle's capacity.

## Pre-flight

No SQL migration. The `campaigns.vehicles` jsonb already accepts arbitrary shapes; tolerant reads (`normalizeInventoryItem`) fill missing fields at render time.

## Read-tolerance (legacy data)

1. Open an existing vehicle whose cargo was added before this change (no `enc` / `rarity` / `custom` fields).
2. **Expected**: cargo renders without errors. Items with no `enc` show no `[N]` weight badge. The header shows `0 / <cap>` because nothing has weight.
3. The VehicleCard summary in the right-side panel also shows `0 / <cap>` in the Enc stat.

## Mongrels — Minnie auto-seeded enc

1. Create a fresh **Mongrels** campaign.
2. Open the Vehicles popout for Minnie.
3. **Expected**: Cargo header shows `98 / 100` (98 enc total, 2 slack from 100 cap). No OVERLOADED warning.
4. Each item with `enc > 0` shows a `[total]` badge — e.g. Automatic Rifles ×4 shows `[8]` because 4 × 2 enc.
5. VehicleCard summary in the right-panel reads the same.

## Add from catalog (auto-fill enc)

1. Open Vehicle popout → Cargo & Equipment → **+ Add**.
2. Type `Backpack` in the Item name field.
3. **Expected**: Enc field auto-fills with `0` (Backpack's catalog enc).
4. Type `Toolkit` instead.
5. **Expected**: Enc auto-fills with `1`.
6. Submit. Item appears in cargo with the correct enc badge.

## Add custom item

1. Open Add. Type `Mystery Box` (not in catalog). Set Qty=2, Enc=3.
2. Submit.
3. **Expected**: Item appears with `[6]` badge (2 × 3 enc). Cargo total updates accordingly.
4. Reopen the popout — item persists.

## Stack-merging

1. Cargo has `Hunting Knives ×10` (enc 1).
2. Add `Hunting Knives` Qty=5 Enc=1.
3. **Expected**: existing row updates to `Hunting Knives ×15`. No duplicate row. Cargo total goes up by 5.

## Decrement / remove

1. Click the × on a cargo row with qty > 1.
2. **Expected**: qty decrements by 1; enc total drops by that item's enc.
3. Click × on a row with qty 1.
4. **Expected**: row disappears entirely. Enc total drops accordingly.

## OVERLOADED state

1. Add enough cargo to push past Minnie's 100 cap (e.g. 5× custom item with enc=10).
2. **Expected**: header turns red, shows `XXX / 100 OVERLOADED`. VehicleCard summary's Enc stat also turns red.
3. Drop / decrement until back under cap.
4. **Expected**: red state clears.

## VehicleCard summary update

1. Open the table view → Vehicles tab → expand a vehicle's card.
2. **Expected**: the **Enc** stat shows current/cap (e.g. `98 / 100`) instead of the static `100` it used to show.
3. Hover the stat — tooltip explains the calculation.

## Regression — vehicle popout other features

1. Confirm WP / fuel / floorplan / driver / brewer / mounted weapons all still work as before.
2. Operator notes still editable.
3. Crew assignment still functional.

## Backward compatibility — manual SQL edit (optional)

If you want to clean a legacy vehicle's cargo data permanently:
```sql
-- inspect first
SELECT vehicles FROM campaigns WHERE id = '<campaign-id>';
```
The reads stay tolerant indefinitely; no migration required.
