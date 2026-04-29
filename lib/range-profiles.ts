// Per-weapon range CMod profiles + range band thresholds
// null = weapon cannot be used at that range (attack blocked)

export type RangeBand = 'engaged' | 'close' | 'medium' | 'long' | 'distant'

// Range band thresholds in feet (upper bound, inclusive)
export const RANGE_BAND_MAX_FEET: Record<RangeBand, number> = {
  engaged: 5,
  close: 30,
  medium: 100,
  long: 300,
  distant: Infinity,
}

export function getRangeBand(feet: number): RangeBand {
  if (feet <= 5) return 'engaged'
  if (feet <= 30) return 'close'
  if (feet <= 100) return 'medium'
  if (feet <= 300) return 'long'
  return 'distant'
}

export interface RangeProfile {
  engaged: number | null
  close: number | null
  medium: number | null
  long: number | null
  distant: number | null
}

// Weapon profile categories — each weapon in weapons.ts maps to one of these
const PROFILES: Record<string, RangeProfile> = {
  melee:          { engaged: 0,  close: null, medium: null, long: null, distant: null },
  melee_reach:    { engaged: 0,  close: 0,    medium: null, long: null, distant: null }, // Spear, Staff, Axes — reach weapons
  unarmed:        { engaged: 0,  close: null, medium: null, long: null, distant: null },
  shotgun_close:  { engaged: +1, close: 0,    medium: -4,   long: null, distant: null }, // Sawed-off
  shotgun:        { engaged: +1, close: 0,    medium: -2,   long: -4,   distant: null }, // Pump-action
  light_pistol:   { engaged: -1, close: 0,    medium: -2,   long: -4,   distant: null },
  heavy_pistol:   { engaged: -1, close: 0,    medium: 0,    long: -3,   distant: null }, // effective to ~100 ft
  hunting_rifle:  { engaged: -3, close: -1,   medium: 0,    long: 0,    distant: -2 },
  assault_rifle:  { engaged: -2, close: 0,    medium: 0,    long: 0,    distant: -3 },   // real AR reaches 1000+ ft
  sniper_rifle:   { engaged: -4, close: -2,   medium: 0,    long: +1,   distant: +1 },
  bow:            { engaged: -2, close: 0,    medium: 0,    long: -3,   distant: null }, // bow at 300 ft is hard
  slingshot:      { engaged: 0,  close: 0,    medium: -3,   long: null, distant: null },
  thrown:         { engaged: 0,  close: 0,    medium: -3,   long: null, distant: null },
  grenade:        { engaged: -1, close: 0,    medium: -2,   long: null, distant: null },
  flamethrower:   { engaged: +1, close: 0,    medium: -4,   long: null, distant: null }, // real M2 ~130 ft max
  taser_dart:     { engaged: 0,  close: -1,   medium: null, long: null, distant: null }, // probes only work 15-25 ft
  heavy_mounted:  { engaged: -1, close: 0,    medium: 0,    long: -2,   distant: -4 },   // Gatling, real 1000+ ft
  rpg:            { engaged: null, close: 0,  medium: 0,    long: 0,    distant: -2 }, // Can't fire at own feet
}

// Map weapon names to profile keys
const WEAPON_PROFILE_MAP: Record<string, string> = {
  // Unarmed (pseudo-weapon)
  'Unarmed': 'unarmed',
  // Melee — Engaged-only
  'Baseball Bat': 'melee',
  'Brass Knuckles': 'unarmed',
  'Club': 'melee',
  'Hatchet': 'melee',
  'Hunting Knife': 'melee',
  'Kitchen Knife': 'melee',
  'Machete': 'melee',
  'Makeshift Club': 'melee',
  'Sledgehammer': 'melee',
  'Sword': 'melee',
  'Tactical Baton': 'melee',
  'Cattle Prod': 'melee',
  'Taser': 'taser_dart', // projectile darts, ~15-25 ft
  // Melee — reach (Close range)
  'Bullwhip': 'melee_reach',
  'Fire Axe': 'melee_reach',
  'Spear': 'melee_reach',
  'Staff': 'melee_reach',
  'Wood Axe': 'melee_reach',
  // Ranged
  'Assault Rifle': 'assault_rifle',
  'Black Powder Rifle': 'hunting_rifle',
  'Bolt-Action / Pump Rifle': 'hunting_rifle',
  'Bow': 'bow',
  'Carbine': 'assault_rifle',
  'Compound Bow': 'bow',
  'Crossbow': 'bow',
  'Heavy Pistol': 'heavy_pistol',
  'Hunting Rifle': 'hunting_rifle',
  'Light Pistol': 'light_pistol',
  'Shotgun (Pump-Action)': 'shotgun',
  'Shotgun (Sawed-Off)': 'shotgun_close',
  'Slingshot': 'slingshot',
  "Sniper's Rifle": 'sniper_rifle',
  'Tranquilizer Gun': 'taser_dart',
  // Explosive
  'Grenade': 'grenade',
  'Mortar': 'rpg',
  'Shiv-Grenade': 'thrown',
  'Flash-Bang Grenade': 'thrown',
  'Molotov': 'grenade',
  'Rocket Launcher': 'rpg',
  // Heavy
  'Flame-Thrower': 'flamethrower',
  'Mounted Turret / Gatling Gun': 'heavy_mounted',
}

export function getWeaponRangeProfile(weaponName: string): RangeProfile | null {
  const key = WEAPON_PROFILE_MAP[weaponName]
  return key ? PROFILES[key] : null
}

export function getWeaponRangeCMod(weaponName: string, band: RangeBand): number | null {
  const profile = getWeaponRangeProfile(weaponName)
  if (!profile) return 0 // unknown weapon, no penalty
  return profile[band]
}

// Returns true if weapon can hit at this range
export function canHitAtRange(weaponName: string, band: RangeBand): boolean {
  return getWeaponRangeCMod(weaponName, band) !== null
}

// Color per band for tactical map overlay
export const RANGE_BAND_COLOR: Record<RangeBand, string> = {
  engaged: 'rgba(192,57,43,0.20)',   // red
  close:   'rgba(239,159,39,0.18)',  // orange
  medium:  'rgba(234,217,44,0.15)',  // yellow
  long:    'rgba(52,152,219,0.15)',  // blue
  distant: 'rgba(120,120,120,0.18)', // grey
}
