// Vehicle damage tables - bespoke per-vehicle "roll 2d6 when the vehicle takes
// damage" tables. Currently only Minnie (the Mongrels' bus). Pure data + lookup
// so the table content + the 2d6 -> system mapping are unit-testable; the
// roll-and-highlight UI lives in components/VehicleDamageTable.tsx.
//
// Source: the updated Minnie guide (Xero, 2026-05-24). The source had a typo
// (two "8" rows, no "9"); Xero confirmed the second is 9 = Still - minor damage.

export interface VehicleDamageRow {
  roll: number
  system: string
  effect: string
  repair: string
}

export interface VehicleDamageTable {
  vehicleName: string
  intro: string
  stats: string
  rows: VehicleDamageRow[]
  thresholds: string
  gmNotes: string
}

export const MINNIE_DAMAGE_TABLE: VehicleDamageTable = {
  vehicleName: 'Minnie',
  intro:
    'Roll 2d6 when Minnie takes damage from a Moment of Low Insight, a combat hit, or any event that causes vehicle damage. Apply WP loss first, then roll this table to determine which system was affected.',
  stats:
    'Minnie: Size 5 · WP 67 (50+5d6) · Stressed below 50 WP (-1 CMod to Driving) · Wrecked below 17 WP (requires repair before driving) · Written Off at 0 WP',
  rows: [
    {
      roll: 2,
      system: 'Still - catastrophic',
      effect:
        'The still ruptures and methanol ignites. Roll 1d6 each round - on 1-3 the fire spreads; on 4-6 it is contained. There is a +1 CMod for everyone helping fight the fire. If not controlled within 1d6 rounds, Minnie explodes. All fuel reserves not in sealed tanks are lost. The still cannot produce fuel until rebuilt.',
      repair:
        'Wild Success on a Mechanic* check to rebuild on the road. Anything less needs a workshop. Costs 8 units of Uncommon Supplies.',
    },
    {
      roll: 3,
      system: 'Engine - seized',
      effect:
        'Minnie stops wherever she is and will not move today. -2 CMod to all Driving checks for the remainder of the trip until fully repaired.',
      repair: 'Mechanic* check + 1 full day stationary + Uncommon Supplies. A failed repair costs another full day.',
    },
    {
      roll: 4,
      system: 'Fuel line - ruptured',
      effect:
        'Methanol is leaking. Lose 1 tank of fuel per hour of driving until repaired. Open flame or weapons fire near Minnie risks ignition: roll 1d6, on 1-2 treat as a result of 2 on this table.',
      repair: 'Tinkerer or Mechanic* check + Common Supplies. Can be done roadside but requires stopping. Takes 2-3 hours.',
    },
    {
      roll: 5,
      system: 'Tires - two blown',
      effect:
        'Two tires gone simultaneously. Minnie stops. Speed drops to 1. -1 CMod to Driving checks on anything but flat road until both are replaced.',
      repair: 'One spare is on the vehicle - covers one tire. The second must be scavenged. Fitting requires a Mechanic* or Tinkerer check.',
    },
    {
      roll: 6,
      system: 'Steering - compromised',
      effect: '-2 CMod to all Driving checks. On mountain passes, a Dire Failure on any Driving check means loss of directional control.',
      repair: 'Mechanic* or Tinkerer + Common Supplies. Roadside fix. Takes half a day if parts are available.',
    },
    {
      roll: 7,
      system: 'Engine - overheating',
      effect:
        'Must stop for 1 hour per 2 hours of driving. Above 5,000ft, an additional Driving check is required each hour or Minnie stops. -1 CMod to Driving checks.',
      repair: 'Mechanic* or Tinkerer at next stop + Common Supplies. Coolant, if available, adds +1 CMod to the repair check.',
    },
    {
      roll: 8,
      system: 'Windows and doors',
      effect:
        'One or more windows are gone or jammed. Passengers on that side are exposed to weather, dust, and incoming fire. -1 DMR for occupants on the affected side.',
      repair: 'Board up with scavenged material - Tinkerer check. Not a full repair but removes the combat penalty.',
    },
    {
      roll: 9,
      system: 'Still - minor damage',
      effect:
        'The still is damaged but intact. The next brew check carries a -2 CMod. On a Failure the batch is lost entirely. Something smells wrong and the players know it.',
      repair: 'Mechanic* or Tinkerer before the next brew day. Failure to repair means the -2 CMod persists into subsequent brew checks.',
    },
    {
      roll: 10,
      system: 'Body damage only',
      effect:
        'Cosmetic and structural damage to the bodywork - dents, scrapes, a panel torn back. No mechanical effect. Apply WP loss only. Minnie looks worse. She runs the same.',
      repair: 'No functional repair needed. Cosmetic repair possible with Tinkerer and time, if the players care.',
    },
    {
      roll: 11,
      system: 'Tire - one blown',
      effect:
        'One tire blows. Minnie can limp to the next safe stop at half speed. The spare comes off the mount. Until a new spare is found, any further tire damage is treated as a roll of 5.',
      repair: 'Replace with the spare - no check required. Scavenge for a replacement spare at the next opportunity.',
    },
    {
      roll: 12,
      system: "Sniper's nest - disabled",
      effect:
        'The roof hatch jams or the ladder is damaged. The nest and the M60 mount are intact but cannot be reached. Characters cannot fire from elevation until repaired.',
      repair: 'Tinkerer check while stationary. Common Supplies. Can be done at camp - does not require a full stop day.',
    },
  ],
  thresholds:
    'Above 50 WP - Operational. 34-50 WP - Stressed (-1 CMod to all Driving checks). Below 17 WP - Wrecked (Mechanic* + Uncommon Supplies required before driving). 0 WP - Written Off (cannot be driven again).',
  gmNotes:
    'Roll after applying WP loss - this table determines which system took the hit, not whether damage occurred. A roll of 2 during a brew day skips the table - treat as an immediate still fire. Multiple damage events in one scene: roll separately for each and stack effects. Cal aboard adds +1 CMod to all repair checks from Day 32 onward.',
}

// 2d6 sum -> the affected-system row. Returns undefined for out-of-range sums.
export function damageRowForRoll(table: VehicleDamageTable, sum: number): VehicleDamageRow | undefined {
  return table.rows.find(r => r.roll === sum)
}

// Resolve which damage table (if any) a vehicle uses. Minnie is the only one
// today; matched by name (case-insensitive) so no per-record data migration is
// needed. Extend here (or move to a flag) when other vehicles get tables.
export function resolveVehicleDamageTable(vehicle: { name?: string | null } | null | undefined): VehicleDamageTable | null {
  const name = (vehicle?.name ?? '').trim().toLowerCase()
  return name === 'minnie' ? MINNIE_DAMAGE_TABLE : null
}
