# Test Plan — Inventory #2: PC → NPC trade

Shipped 2026-04-30. The InventoryPanel "Give" picker now lists NPCs as recipients alongside other PCs. NPC → PC was already supported (loot-from-NPC); this closes the symmetric gap.

## Pre-flight

No SQL migration. RLS on `campaign_npcs` already permits campaign-member UPDATEs (via `sql/campaign-npcs-rls-fix.sql`).

## Setup

A campaign with:
- At least one logged-in player with a PC carrying some items
- At least one campaign NPC (any tier, not hidden, not dead)

## Golden path — give from PC to NPC

1. Open the PC's character sheet → click 🎒 Inventory.
2. Find an item with qty ≥ 1 → click "Give".
3. **Expected**: the recipient strip now shows two rows of buttons:
   - Blue **👤 PC Name** chips for every other PC in the session
   - Orange **🎭 NPC Name** chips for every visible (non-hidden, non-dead) campaign NPC
4. Click an NPC chip.
5. **Expected**:
   - The give modal closes.
   - The PC's inventory drops the qty (or the row entirely if qty hit 0).
   - In Supabase: `campaign_npcs.inventory` for that NPC has the item appended (or its qty incremented if it already had one).
6. Open the NPC's roster card → 🎒 Inventory → confirm the item is present with the correct qty.

## Golden path — qty stepper

1. Open Inventory, pick an item with qty=5, click Give.
2. Use the Qty stepper to set 3.
3. Click an NPC chip.
4. **Expected**: PC inventory now shows qty=2; NPC's inventory has +3 of that item.

## Hidden NPCs invisible to non-GM

1. As a GM, mark an NPC `hidden_from_players=true`.
2. As a non-GM player, open their PC inventory → Give an item.
3. **Expected**: that hidden NPC does NOT appear in the recipient list. Other (visible) NPCs do.
4. Switch to the GM account; same flow.
5. **Expected**: GM sees ALL NPCs including hidden ones (no hidden filter for GM).

## Dead NPCs filtered out

1. Mark an NPC `status='dead'`.
2. Open Give from a PC.
3. **Expected**: dead NPC does NOT appear. Once `status` flips back to active, the NPC reappears.

## Stack-merging

1. NPC already has 2× Bandages.
2. PC gives them another 3× Bandages.
3. **Expected**: NPC's inventory shows a single Bandages row with qty=5, not two separate rows.

## Custom-vs-catalog dedup

1. PC has `Bandages` (custom=false, from catalog).
2. NPC also has `Bandages` (custom=true, GM hand-typed).
3. PC gives 1× Bandages.
4. **Expected**: NPC ends up with TWO separate rows — one custom=false from the transfer, one custom=true preexisting. They merge only when (name, custom) match — same rule as PC↔PC transfer.

## Regression — NPC → PC (loot from NPC) still works

1. Open the NPC's card → 🎒 Inventory.
2. Click Give on one of their items.
3. **Expected**: recipient list shows PC chips only (NpcCard doesn't pass `otherNpcs`/`onGiveToNpc`). Behavior identical to before — give to a PC, item lands on the PC's character.data.inventory.

## Regression — PC ↔ PC still works

1. PC1 gives item to PC2 from inventory.
2. **Expected**: identical behavior to before — character row updated, broadcast fired, notification RPC fired.

## Local sync after PC → NPC give

1. After giving an item to an NPC, open the NPC roster (sidebar) WITHOUT a manual refresh.
2. Open the NPC's inventory.
3. **Expected**: the new item is visible. (Local state patches `campaignNpcs`/`rosterNpcs`/`viewingNpcs` in addition to the DB write, so the UI doesn't need a re-fetch.)

## Edge — non-GM player giving to NPC

1. As a non-GM player, give an item to a campaign NPC.
2. **Expected**: write succeeds (RLS already permits campaign members to update campaign_npcs). NPC's inventory in DB reflects the change.
3. The GM, viewing the NPC's roster, sees the new item once they receive the `npc_inventory_changed` broadcast.
