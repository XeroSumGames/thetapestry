// Shared inventory types. Single source of truth so PC inventory,
// NPC inventory, and vehicle cargo all speak the same shape.
//
// Originally lived in components/InventoryPanel.tsx; moved here so
// non-component callers (VehicleCard, lib/setting-vehicles, future
// loot/trade helpers) can import without pulling in a React module.

export interface InventoryItem {
  name: string
  enc: number
  rarity: string
  notes: string
  qty: number
  custom: boolean
  /** Armor only: true when the item is currently equipped (DM
   *  applies to damage resolution). ENC does NOT change with
   *  worn status - armor weighs the same on or off. Default false
   *  for non-armor items and unset entries. See
   *  `lib/xse-schema.ts:ARMOR` for the canonical armor catalog. */
  worn?: boolean
}

// Tolerant normalizer for cargo / inventory entries that pre-date the
// unified shape (vehicle cargo used to be { name, qty, notes } only).
// Missing fields default conservatively: enc=0 (no weight), rarity
// 'Common', custom=true (so the catalog isn't claimed as the source).
export function normalizeInventoryItem(raw: any): InventoryItem {
  return {
    name: typeof raw?.name === 'string' ? raw.name : '',
    enc: typeof raw?.enc === 'number' ? raw.enc : 0,
    rarity: typeof raw?.rarity === 'string' && raw.rarity ? raw.rarity : 'Common',
    notes: typeof raw?.notes === 'string' ? raw.notes : '',
    qty: typeof raw?.qty === 'number' && raw.qty > 0 ? raw.qty : 1,
    custom: typeof raw?.custom === 'boolean' ? raw.custom : true,
    worn: typeof raw?.worn === 'boolean' ? raw.worn : false,
  }
}
