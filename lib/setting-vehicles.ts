// Setting → seed Vehicles. Mirrors lib/setting-npcs.ts / -scenes.ts /
// -handouts.ts: each setting that ships with default vehicle(s) lists
// them here, and app/stories/new/page.tsx writes them to
// campaigns.vehicles on campaign creation. Without this, a brand-new
// Mongrels campaign opens with an empty Vehicles list and the Minnie
// popout has no information to render.
//
// Shape MUST match VehicleCard's Vehicle interface (camelCase fields).
// Cargo is the unified InventoryItem shape now (was { name, qty, notes }
// only — extra fields default to enc=0 / rarity='Common' / custom=true
// at read time via normalizeInventoryItem). wp_current/fuel_current
// default to their respective max so the vehicle starts at full health/
// tank.

export interface SeedVehicleCargo {
  name: string
  qty: number
  notes?: string
  enc?: number
  rarity?: string
  custom?: boolean
}

export interface SeedVehicle {
  id: string
  name: string
  type: string
  rarity: string
  size: number
  speed: number
  passengers: number
  encumbrance: number
  range: string
  wp_max: number
  wp_current: number
  stress: number
  fuel_max: number
  fuel_current: number
  three_words?: string
  notes?: string
  image_url?: string | null
  floorplan_url?: string | null
  has_still?: boolean
  mounted_weapons?: { name: string; notes?: string }[]
  cargo: SeedVehicleCargo[]
}

const MINNIE: SeedVehicle = {
  id: 'minnie-001',
  name: 'Minnie',
  type: 'Recreational Vehicle',
  rarity: 'Common',
  size: 5,
  // Bumped from 2 → 3 (2026-04-26): Speed 2 = bicycle, which read too
  // slow for a 9000lb RV. Speed 3 (= horse galloping) better reflects
  // Minnie's actual road pace and gives her 90ft/round on the tactical
  // grid via the vehicle Move button (Speed × 30ft/round mapping).
  speed: 3,
  passengers: 5,
  encumbrance: 100,
  range: '660 (231/132)',
  wp_max: 67,
  wp_current: 67,
  stress: 0,
  fuel_max: 4,
  fuel_current: 4,
  three_words: 'Cramped and Noisy',
  notes:
    'An alcohol Distillery has been fitted to this Winnebago "Minnie".\n' +
    '- The still can only be operated when the vehicle is stopped or it has a 50% chance (1-3 on 1d6) of catching fire or exploding.\n' +
    '- It takes 1 day of gathering materials and 1 day of distilling to produce 2 days of fuel. Requires a Tinkerer or Mechanic* check.\n' +
    "- There are storage tanks built into the RV's bodywork that allow for the storage of up to 4 days of fuel.\n" +
    '- Has a weapon nest built on the top, between the AC units, with a fitted M60 that only fires forward in a 90 degree arc.',
  image_url: null,
  floorplan_url: '/minnie-floorplan.png?v=20260427',
  has_still: true,
  mounted_weapons: [
    {
      name: 'M60 (Mounted)',
      notes: 'Mounted in the roof weapon nest between the AC units. Fires forward in a 90° arc only.',
    },
  ],
  // Enc values cataloged from lib/xse-schema.ts EQUIPMENT/weapons
  // where there's a name match; otherwise reasonable estimates per
  // SRD §05 weapon-class encumbrance (long guns 2, pistols/melee 1,
  // mounted heavies 3, body armor 1, throwables 0). Sums to 98 of
  // Minnie's 100 capacity — slack so a couple of looted extras fit
  // before OVERLOADED kicks in.
  cargo: [
    { name: 'Tactical Vests',       qty: 6,  enc: 1, notes: '-3 DMR/DMM' },
    { name: 'Tactical Helmets',     qty: 6,  enc: 1, notes: '-1 DMR/DMM' },
    { name: 'Tactical Shield',      qty: 2,  enc: 2, notes: '-1 DMR/DMM' },
    { name: 'Automatic Rifles',     qty: 4,  enc: 2, notes: '300 rounds each' },
    { name: 'Shotgun',              qty: 4,  enc: 2, notes: '40 rounds each' },
    { name: 'Heavy Pistols',        qty: 6,  enc: 1, notes: '90 rounds each' },
    { name: 'Light Pistols',        qty: 10, enc: 1, notes: '90 rounds each' },
    { name: 'Hunting Rifle',        qty: 2,  enc: 2, notes: '50 rounds each' },
    { name: 'M60 (Mounted)',        qty: 1,  enc: 3, notes: '300 rounds belt-fed' },
    { name: 'Tactical Batons',      qty: 6,  enc: 1, notes: '' },
    { name: 'Tasers',               qty: 3,  enc: 1, notes: '' },
    { name: 'Grenades',             qty: 20, enc: 0, notes: '' },
    { name: 'Flash-bang Grenades',  qty: 20, enc: 0, notes: '' },
    { name: 'Hunting Knives',       qty: 10, enc: 1, notes: '' },
    { name: 'Bow',                  qty: 2,  enc: 1, notes: '60 arrows' },
    { name: 'Binoculars',           qty: 4,  enc: 1, notes: '' },
    { name: 'Walkie-Talkies',       qty: 12, enc: 0, notes: '' },
    { name: 'First Aid Kit',        qty: 6,  enc: 1, notes: '' },
    { name: "Angler's Kit",         qty: 10, enc: 1, notes: '' },
    { name: 'Toolkit',              qty: 1,  enc: 1, notes: '' },
    { name: "Mechanic's Toolkit",   qty: 1,  enc: 1, notes: '' },
  ],
}

export const SETTING_VEHICLES: Record<string, SeedVehicle[]> = {
  mongrels: [MINNIE],
  // Other settings can opt in by listing their starting vehicle(s) here.
}
