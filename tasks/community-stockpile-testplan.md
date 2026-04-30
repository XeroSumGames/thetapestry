# Test Plan — Inventory #4: Shared Community Stockpile

Shipped 2026-04-30. Communities now own a `community_stockpile_items` row-table — a shared resource pool members can deposit into via their PC's InventoryPanel and the GM/members can curate inline on the community panel.

## Pre-flight

Apply migration in Supabase SQL editor:
- [sql/community-stockpile.sql](../sql/community-stockpile.sql) — creates the `community_stockpile_items` table + RLS + UNIQUE dedup index + NOTIFY pgrst.

Verify:
```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'community_stockpile_items'
  ORDER BY ordinal_position;
-- expect: id, community_id, name, enc, rarity, notes, qty, custom, created_at
```

## Setup

A campaign with a community of 13+ members + at least one PC who's already a community member. (Add the PC via the community panel's "Add Member" form if needed.)

## Curate inline (GM or member)

1. Open the community panel → expand the community.
2. **Expected**: a new **📦 Stockpile** card appears below Role Coverage with "empty" subtext and a `+ Add` button.
3. Click `+ Add`. Type `Toolkit` in the name field.
4. **Expected**: Enc auto-fills with `1` (Toolkit's catalog enc).
5. Set Qty=2, Notes optional. Click **Add to Stockpile**.
6. **Expected**: row appears `Toolkit ×2 [2]` (qty × enc badge). Header subtext updates to `1 items · 2 enc`.
7. Add a custom item: name `Bandages`, Qty=10, Enc=0. Submit.
8. **Expected**: second row appears.

## Stack-merge on duplicate add

1. Click `+ Add`, type `Toolkit` again, Qty=3. Submit.
2. **Expected**: existing row updates to `Toolkit ×5 [5]`. No duplicate row. Header subtext updates accordingly.

## Remove / decrement

1. Click × on a row with qty > 1.
2. **Expected**: qty drops by 1.
3. Click × on a qty=1 row.
4. **Expected**: row disappears.

## PC deposit via InventoryPanel

1. Open the PC's character sheet → 🎒 Inventory.
2. Find an item (qty ≥ 1) → click "Give".
3. **Expected**: recipient strip now shows three groups:
   - 👤 Blue PC chips
   - 🎭 Orange NPC chips
   - 🏘 Purple **community** chips for any community the PC is a member of
4. Click a 🏘 community chip.
5. **Expected**:
   - PC's inventory drops the qty (or row vanishes if qty hit 0).
   - Reload the community panel → the deposited item appears in the stockpile.
   - If the community already had that item by name+custom, qty merged.

## RLS — non-member can't see communities they aren't in

1. As Player A in Campaign X (member of Community 1), open InventoryPanel → Give.
2. **Expected**: only Community 1 in the chip list. NOT Community 2 or any other campaign's community.

## Empty-state

1. Fresh community with no stockpile items.
2. **Expected**: "empty" subtext where item count would normally show. Add button still visible.

## Cross-window sync

1. Two browser windows on the same campaign (e.g., GM in one, Player in another).
2. Player deposits an item via their PC sheet.
3. GM reloads the community panel.
4. **Expected**: deposited item appears. (No realtime sub on this table yet — manual reload required for now. Can add `community_stockpile_realtime.sql` later if it bites.)

## Regression — existing flows untouched

1. PC ↔ PC inventory transfer still works.
2. PC ↔ NPC inventory transfer still works.
3. Vehicle cargo encumbrance display still works.
4. Community Morale Check / Schism / Migration / Publish-to-Tapestry all unchanged.

## Followups (NOT in this ship)

- **Withdrawal-to-PC flow** — clicking a stockpile item routes it onto a community member's character sheet. Today removal just decrements; the GM manually adds to the receiving PC. Can build a similar give-modal pattern in reverse if it's painful in play.
- **Realtime sub on community_stockpile_items** — currently manual reload to see another player's deposit. Cheap to add when needed.
- **Aggregate "Supplies" stat** — sum cargo with rarity=Supplies (or named match) to feed into Maintainers' Clothed Check or Gatherers' Fed Check. Spec mentions this; not built yet.
