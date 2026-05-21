// Encumbrance - shared formula used by InventoryPanel + CharacterCard
// (and any future inventory surface). Single source of truth: change
// the rules here, every UI updates.
//
// XSE rule: ENC limit = 6 + PHY + Pack(2 if Backpack/Military Backpack).
// Current load = sum of held weapon enc + sum of inventory enc * qty.

import { getWeaponByName } from './weapons'

export const BASE_ENC_LIMIT = 6
const BACKPACK_BONUS = 2
const BACKPACK_NAMES = new Set(['Backpack', 'Military Backpack'])

export interface EncumbranceItem {
  name: string
  enc: number
  qty: number
}

export interface Encumbrance {
  weaponEnc: number
  invEnc: number
  currentEnc: number
  encLimit: number
  hasBackpack: boolean
  backpackBonus: number
  overloaded: boolean
  /** Points over the limit (currentEnc - encLimit), floored at 0.
   *  Canon (Distemper, restored 2026-05-20): an overloaded character
   *  takes 1 RP damage per hour FOR EACH point over the limit (not a
   *  flat 1/hr) + moves at half speed until they drop weight or rest.
   *  This is the per-hour RP-drain multiplier. */
  overBy: number
}

export function computeEncumbrance(
  inventory: EncumbranceItem[],
  weaponPrimaryName: string,
  weaponSecondaryName: string,
  phyMod: number,
): Encumbrance {
  const wp = getWeaponByName(weaponPrimaryName)
  const ws = getWeaponByName(weaponSecondaryName)
  const weaponEnc = (wp?.enc ?? 0) + (ws?.enc ?? 0)
  const invEnc = inventory.reduce((sum, item) => sum + (item.enc ?? 0) * (item.qty ?? 1), 0)
  const hasBackpack = inventory.some(i => BACKPACK_NAMES.has(i.name))
  const backpackBonus = hasBackpack ? BACKPACK_BONUS : 0
  const encLimit = BASE_ENC_LIMIT + phyMod + backpackBonus
  const currentEnc = weaponEnc + invEnc
  const overloaded = currentEnc > encLimit
  const overBy = Math.max(0, currentEnc - encLimit)
  return { weaponEnc, invEnc, currentEnc, encLimit, hasBackpack, backpackBonus, overloaded, overBy }
}
