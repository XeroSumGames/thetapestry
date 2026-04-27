// XSE SRD Weapon Database

export type WeaponCategory = 'melee' | 'ranged' | 'explosive' | 'heavy'
export type Range = 'Engaged' | 'Close' | 'Medium' | 'Long' | 'Distant'
export type Rarity = 'Common' | 'Uncommon' | 'Rare'
export type Condition = 'Pristine' | 'Used' | 'Worn' | 'Damaged' | 'Broken'
export type Skill = 'Melee Combat' | 'Unarmed Combat' | 'Ranged Combat' | 'Heavy Weapons' | 'Athletics' | 'Demolitions'

export interface Weapon {
  name: string
  category: WeaponCategory
  skill: Skill
  range: Range
  rarity: Rarity
  damage: string        // e.g. "4+1d6", "+1" (for Brass Knuckles)
  rpPercent: number     // 100 or 50
  enc: number
  ammo?: Rarity         // ammo rarity, undefined for melee
  clip?: number         // rounds per clip
  traits: string[]
}

export const CONDITION_CMOD: Record<Condition, number> = {
  Pristine: 1,
  Used: 0,
  Worn: -1,
  Damaged: -2,
  Broken: -99, // unusable
}

export const CONDITION_LABELS: Record<Condition, string> = {
  Pristine: 'Perfect working order. +1 CMod when used.',
  Used: 'Good working order.',
  Worn: 'Works but requires care. -1 CMod when used.',
  Damaged: 'Not working properly. -2 CMod when used.',
  Broken: 'Cannot be used unless repaired back to Damaged.',
}

export const CONDITIONS: Condition[] = ['Pristine', 'Used', 'Worn', 'Damaged', 'Broken']

export const TRAIT_DESCRIPTIONS: Record<string, string> = {
  'Automatic Burst': 'Can fire multiple rounds simultaneously at anyone at Engaged range. Uses listed number of rounds per burst.',
  'Blast Radius': 'Causes damage within an area. Engaged = full damage, Close = 50%, further = 25%.',
  'Burning': 'Besides initial damage, target suffers additional WP/RP per round for d3 rounds.',
  'Cone-Up': 'Hits indiscriminately at Engaged range, target sustains 50% damage.',
  'Cumbersome': 'Requires Physicality of (X) to use, or incurs -X CMod.',
  'Stun': 'Deals no WP damage. On Wild Success or High Insight, target incapacitated for 1d6 - PHY AMod rounds (min 1).',
  'Tracking': 'When players Ready Their Weapon before an attack, they also track their target. +1 CMod on next attack.',
  'Unwieldy': 'Requires Dexterity of (X) to use correctly, or incurs -X CMod.',
  'Close-Up': 'Hits indiscriminately at Engaged range, target sustains 50% damage.',
}

/** Parse a numeric trait value, e.g. "Cumbersome (2)" → 2, "Stun" → 0, missing → null */
export function getTraitValue(traits: string[], traitName: string): number | null {
  const t = traits.find(tr => tr.startsWith(traitName))
  if (!t) return null
  const match = t.match(/\((\d+)\)/)
  return match ? parseInt(match[1]) : 0
}

// ── MELEE WEAPONS (Table 16) ──

export const MELEE_WEAPONS: Weapon[] = [
  { name: 'Bayonet / Bowie Knife', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Common', damage: '4+1d6', rpPercent: 100, enc: 1, traits: [] },
  { name: 'Brass Knuckles', category: 'melee', skill: 'Unarmed Combat', range: 'Engaged', rarity: 'Uncommon', damage: '+1', rpPercent: 100, enc: 0, traits: [] },
  { name: 'Bat / Stick', category: 'melee', skill: 'Athletics', range: 'Close', rarity: 'Uncommon', damage: '1+1d3', rpPercent: 100, enc: 1, traits: ['Unwieldy (2)'] },
  { name: 'Cleaver', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Common', damage: '5+1d6', rpPercent: 100, enc: 2, traits: ['Cumbersome (1)'] },
  { name: 'Fire Axe', category: 'melee', skill: 'Melee Combat', range: 'Close', rarity: 'Uncommon', damage: '3+2d3', rpPercent: 50, enc: 1, traits: [] },
  { name: 'Hatchet', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Common', damage: '3+1d3', rpPercent: 50, enc: 1, traits: [] },
  { name: 'Hunting Knife', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Common', damage: '2+2d3', rpPercent: 50, enc: 1, traits: ['Unwieldy (1)'] },
  { name: 'Kitchen Knife', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Common', damage: '2+1d3', rpPercent: 50, enc: 1, traits: [] },
  { name: 'Machete', category: 'melee', skill: 'Melee Combat', range: 'Close', rarity: 'Uncommon', damage: '3+2d3', rpPercent: 50, enc: 1, traits: ['Unwieldy (2)'] },
  { name: 'Makeshift Cleaver', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Common', damage: '3+1d3', rpPercent: 100, enc: 1, traits: [] },
  { name: 'Sledgehammer', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Uncommon', damage: '3+3d3', rpPercent: 100, enc: 2, traits: ['Cumbersome (2)'] },
  { name: 'Spear', category: 'melee', skill: 'Melee Combat', range: 'Close', rarity: 'Uncommon', damage: '2+2d6', rpPercent: 50, enc: 1, traits: ['Cumbersome (2)'] },
  { name: 'Staff', category: 'melee', skill: 'Melee Combat', range: 'Close', rarity: 'Common', damage: '2+2d3', rpPercent: 100, enc: 1, traits: ['Unwieldy (1)'] },
  { name: 'Sword', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Uncommon', damage: '3+3d3', rpPercent: 50, enc: 1, traits: [] },
  { name: 'Katana', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Rare', damage: '4+3d3', rpPercent: 50, enc: 1, traits: ['Unwieldy 1'] },
  { name: 'Tactical Baton', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Uncommon', damage: '4+2d3', rpPercent: 100, enc: 1, traits: [] },
  { name: 'Cattle Prod', category: 'melee', skill: 'Melee Combat', range: 'Engaged', rarity: 'Uncommon', damage: '2', rpPercent: 400, enc: 1, traits: ['Stun'] },
  { name: 'Wood Axe', category: 'melee', skill: 'Melee Combat', range: 'Close', rarity: 'Uncommon', damage: '5+1d3', rpPercent: 50, enc: 1, traits: ['Cumbersome (1)'] },
]

// ── RANGED WEAPONS (Table 17) ──

export const RANGED_WEAPONS: Weapon[] = [
  { name: 'Assault Rifle', category: 'ranged', skill: 'Ranged Combat', range: 'Long', rarity: 'Uncommon', damage: '5+2d6', rpPercent: 50, enc: 2, ammo: 'Uncommon', clip: 30, traits: ['Automatic Burst (3)'] },
  { name: 'Bolt-Action / Pump Rifle', category: 'ranged', skill: 'Ranged Combat', range: 'Long', rarity: 'Uncommon', damage: '5+1d6', rpPercent: 50, enc: 2, ammo: 'Uncommon', clip: 1, traits: [] },
  { name: 'Bow', category: 'ranged', skill: 'Ranged Combat', range: 'Medium', rarity: 'Common', damage: '4+1d6', rpPercent: 50, enc: 1, ammo: 'Common', clip: 1, traits: ['Tracking'] },
  { name: 'Carbine', category: 'ranged', skill: 'Ranged Combat', range: 'Long', rarity: 'Uncommon', damage: '5+1d6', rpPercent: 50, enc: 1, ammo: 'Uncommon', clip: 30, traits: ['Automatic Burst'] },
  { name: 'Compact Bow', category: 'ranged', skill: 'Ranged Combat', range: 'Medium', rarity: 'Common', damage: '4+2d3', rpPercent: 50, enc: 2, ammo: 'Common', clip: 1, traits: ['Tracking'] },
  { name: 'Crossbow', category: 'ranged', skill: 'Ranged Combat', range: 'Medium', rarity: 'Uncommon', damage: '4+1d6', rpPercent: 50, enc: 2, ammo: 'Uncommon', clip: 1, traits: ['Unwieldy (1)'] },
  { name: 'Heavy Pistol', category: 'ranged', skill: 'Ranged Combat', range: 'Medium', rarity: 'Common', damage: '3+2d3', rpPercent: 50, enc: 1, ammo: 'Uncommon', clip: 9, traits: [] },
  { name: 'Hunting Rifle', category: 'ranged', skill: 'Ranged Combat', range: 'Long', rarity: 'Common', damage: '5+1d6', rpPercent: 50, enc: 2, ammo: 'Uncommon', clip: 12, traits: [] },
  { name: 'Light Pistol', category: 'ranged', skill: 'Ranged Combat', range: 'Close', rarity: 'Common', damage: '3+1d6', rpPercent: 50, enc: 1, ammo: 'Common', clip: 6, traits: [] },
  { name: 'Shotgun (Pump-Action)', category: 'ranged', skill: 'Ranged Combat', range: 'Medium', rarity: 'Common', damage: '5+2d6', rpPercent: 50, enc: 2, ammo: 'Common', clip: 5, traits: ['Close-Up'] },
  { name: 'Shotgun (Sawed-Off)', category: 'ranged', skill: 'Ranged Combat', range: 'Close', rarity: 'Uncommon', damage: '2+3d6', rpPercent: 50, enc: 2, ammo: 'Common', clip: 2, traits: ['Close-Up'] },
  { name: 'Slingshot', category: 'ranged', skill: 'Ranged Combat', range: 'Close', rarity: 'Common', damage: '1+1d3', rpPercent: 100, enc: 0, ammo: 'Common', clip: 1, traits: ['Tracking'] },
  { name: "Sniper's Rifle", category: 'ranged', skill: 'Ranged Combat', range: 'Distant', rarity: 'Rare', damage: '2+3d6', rpPercent: 50, enc: 2, ammo: 'Uncommon', clip: 10, traits: [] },
  { name: 'Taser', category: 'ranged', skill: 'Ranged Combat', range: 'Close', rarity: 'Uncommon', damage: '1', rpPercent: 400, enc: 1, ammo: 'Rare', clip: 1, traits: ['Stun'] },
]

// ── EXPLOSIVE WEAPONS (Table 18) ──

export const EXPLOSIVE_WEAPONS: Weapon[] = [
  { name: 'Grenade', category: 'explosive', skill: 'Athletics', range: 'Medium', rarity: 'Uncommon', damage: '4+4d3', rpPercent: 100, enc: 1, clip: 1, traits: ['Tracking', 'Blast Radius'] },
  { name: 'Shiv-Grenade', category: 'explosive', skill: 'Athletics', range: 'Close', rarity: 'Uncommon', damage: '0', rpPercent: 0, enc: 1, clip: 1, traits: ['Stun'] },
  { name: 'Flash-Bang Grenade', category: 'explosive', skill: 'Athletics', range: 'Close', rarity: 'Uncommon', damage: '0', rpPercent: 0, enc: 1, clip: 1, traits: ['Stun'] },
  { name: 'Molotov', category: 'explosive', skill: 'Demolitions', range: 'Close', rarity: 'Rare', damage: '5+2d6', rpPercent: 100, enc: 2, clip: 1, traits: ['Blast Radius'] },
  { name: 'RPG Launcher', category: 'explosive', skill: 'Demolitions', range: 'Long', rarity: 'Rare', damage: '3+3d6', rpPercent: 100, enc: 2, clip: 1, traits: ['Blast Radius'] },
]

// ── HEAVY WEAPONS (Table 19 — partial) ──

export const HEAVY_WEAPONS: Weapon[] = [
  { name: 'Flamethrower', category: 'heavy', skill: 'Demolitions', range: 'Close', rarity: 'Rare', damage: '3+2d6', rpPercent: 50, enc: 2, clip: 30, traits: ['Burning (3)'] },
  { name: 'Mounted Turret / Gatling Gun', category: 'heavy', skill: 'Heavy Weapons', range: 'Long', rarity: 'Rare', damage: '5+2d6', rpPercent: 50, enc: 3, ammo: 'Uncommon', clip: 100, traits: ['Automatic Burst (5)', 'Cumbersome (2)'] },
  { name: 'M60 (Mounted)', category: 'heavy', skill: 'Heavy Weapons', range: 'Long', rarity: 'Rare', damage: '4+2d6', rpPercent: 50, enc: 3, ammo: 'Uncommon', clip: 100, traits: ['Automatic Burst (5)', 'Cumbersome (2)'] },
]

export const ALL_WEAPONS: Weapon[] = [...MELEE_WEAPONS, ...RANGED_WEAPONS, ...EXPLOSIVE_WEAPONS, ...HEAVY_WEAPONS]

// ── Character Weapon State ──

export interface CharacterWeapon {
  weaponName: string
  condition: Condition
  ammoCurrent: number
  ammoMax: number
  reloads: number
}

export function createCharacterWeapon(weapon: Weapon): CharacterWeapon {
  return {
    weaponName: weapon.name,
    condition: 'Used',
    ammoCurrent: weapon.clip ?? 0,
    ammoMax: weapon.clip ?? 0,
    reloads: weapon.ammo ? Math.floor(Math.random() * 3) + 1 : 0, // 1d3 reloads
  }
}

export function getWeaponByName(name: string): Weapon | undefined {
  return ALL_WEAPONS.find(w => w.name === name)
}

export function conditionColor(condition: Condition): string {
  switch (condition) {
    case 'Pristine': return '#7fc458'
    case 'Used': return '#d4cfc9'
    case 'Worn': return '#EF9F27'
    case 'Damaged': return '#c0392b'
    case 'Broken': return '#7a1f16'
  }
}
