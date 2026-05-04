# NPC Inventory Editing — Testplan (2026-05-02)

Verifies the NPC roster edit form lets a GM author inventory items that players can later loot via 🎒 Search Remains.

## Setup

- Open any campaign you GM, switch to the NPCs tab.
- Pick an NPC and click Edit (pencil icon) on its row.

## Tests

### A — Inventory section visible

1. Scroll the edit modal past the Skills section
2. **Expect:** new "Inventory (loot)" section with an item count chip on the right ("0 items" by default), an empty list area, and a row at the bottom with "+ From SRD catalog…" dropdown + "+ Custom" button

### B — Quick-pick from SRD catalog stacks

1. Click the "+ From SRD catalog…" dropdown, pick "Lighter"
2. **Expect:** a row appears with name=Lighter, qty=1, enc + rarity prefilled from the catalog
3. Pick "Lighter" again from the same dropdown
4. **Expect:** the existing Lighter row's qty increments to 2 (no second row)

### C — Custom item row

1. Click "+ Custom"
2. **Expect:** a fresh empty row appears with qty=1 / enc=0 / rarity=Common
3. Type a name like "Goth Pendant", set enc to 0.5, leave rarity as Common
4. Save the NPC
5. Re-open the edit form
6. **Expect:** the Goth Pendant row is back exactly as authored

### D — Empty-name rows are stripped on save

1. Click "+ Custom" twice — leaves two empty rows
2. Save the NPC without filling either
3. Re-open the edit form
4. **Expect:** neither stub row was persisted; only the named items survive

### E — Quantity / encumbrance / rarity all editable inline

1. On any item row, change qty to 5, enc to 1.0, rarity to Rare
2. Save, re-open
3. **Expect:** all three fields persisted

### F — Remove item

1. Click the × button on any item row
2. **Expect:** row disappears immediately
3. Save, re-open
4. **Expect:** the removed item is gone

### G — Players can loot what was authored

1. With an NPC inventory containing a Goth Pendant ×1, knock the NPC down to wp_current=0 (or status=dead) somehow
2. As a player, open the PlayerNpcCard for that NPC
3. **Expect:** "🎒 Search Remains" lists the Goth Pendant; clicking Take transfers it to the looter's PC inventory and decrements the NPC's count

### H — Round-trip with loot RPC stays consistent

1. Author 3× Lighter on an NPC. Save.
2. Have a player loot 1 Lighter via 🎒 Search Remains
3. Re-open the GM edit form
4. **Expect:** Lighter row now reads qty=2

## Pass criteria

All eight tests pass. The Inventory section feels like a peer of Skills in the edit form — quick to author, no friction.
