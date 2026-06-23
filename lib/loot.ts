// Shared loot routing. The bug this fixes: looting a weapon used to push its
// NAME into character.data.equipment[] (a legacy string list that nothing in
// combat reads), so a looted gun/axe could never be Readied, fired, or meleed.
// Ready Weapon, the Melee action, and encumbrance all read inventory[]
// (InventoryItem rows). This helper routes loot to the slot the app actually
// uses:
//   - weapons      -> inventory[] (stacks qty with a matching catalog entry)
//   - everything else -> equipment[] (legacy gear list, character-sheet only)
// Pure + testable so the routing rule has one home for object loot, the
// loot-bullets NPC-gun drop, and the Disarm ground-token drop alike.

import { getWeaponByName } from './weapons'
import type { InventoryItem } from './inventory'

export interface LootedItem {
  type: 'weapon' | 'equipment'
  name: string
  quantity: number
}

/**
 * Merge a looted item into a character/NPC data blob. Returns a NEW partial
 * { inventory?, equipment? } to spread into the caller's characters.data /
 * campaign_npcs payload - only the touched slot is returned, so the other
 * list is preserved by the spread at the call site.
 */
export function routeLootedItem(
  data: { inventory?: InventoryItem[] | null; equipment?: string[] | null } | null | undefined,
  item: LootedItem,
): { inventory?: InventoryItem[]; equipment?: string[] } {
  const qty = Math.max(1, item.quantity ?? 1)
  if (item.type === 'weapon') {
    const w = getWeaponByName(item.name)
    const inv: InventoryItem[] = Array.isArray(data?.inventory) ? [...data!.inventory!] : []
    // Stack with an existing catalog row of the same weapon (mirrors the
    // Ready Weapon equip/unequip stacking rule); otherwise append a fresh row.
    const idx = inv.findIndex(i => i.name === item.name && !i.custom)
    if (idx >= 0) {
      inv[idx] = { ...inv[idx], qty: inv[idx].qty + qty }
    } else {
      inv.push({
        name: item.name,
        enc: w?.enc ?? 0,
        rarity: w?.rarity ?? 'Common',
        notes: '',
        qty,
        custom: !w,
      })
    }
    return { inventory: inv }
  }
  const equip: string[] = Array.isArray(data?.equipment) ? [...data!.equipment!] : []
  for (let i = 0; i < qty; i++) equip.push(item.name)
  return { equipment: equip }
}
