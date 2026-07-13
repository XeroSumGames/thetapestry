// Ranged-weapon starting loadout - the ONE place the ammo/reload canon lives.
//
// Canon (Xero, locked 2026-07-13): a ranged weapon's starting ammo depends on
// who carries it -
//   - PC:  a FULL clip + 1d6 reloads (so a 6-round gun = 6..36 rounds total).
//   - NPC: 1d6-1 LOADED rounds (0..5 - scarce, a chance it's empty) + 1d3
//          reloads. This is deliberate scavenging scarcity: a gun looted off a
//          body yields scarce ammo. (Supersedes the brief 2026-07-13 "everyone
//          starts full" experiment; the scarcity design was the correct call.)
//
// Before this helper the same dice were copy-pasted across ~6 sites (the PC
// wizard builder, the PC card re-pick, the NPC generator, the NPC roster form,
// and both equip-from-inventory branches) and had already drifted (PCs on 1d3,
// an NPC path using ceil(random*3) which can roll 0). Centralizing kills that
// drift and gives the canon a unit test. Non-clip weapons (melee) carry no ammo.

export interface RangedLoadout {
  ammoCurrent: number
  ammoMax: number
  reloads: number
}

export type LoadoutRole = 'pc' | 'npc'

/**
 * Starting ammo/reloads for a ranged weapon with the given clip size.
 * `rng` is injectable for tests; defaults to Math.random.
 */
export function rangedLoadout(
  clip: number | null | undefined,
  role: LoadoutRole,
  rng: () => number = Math.random,
): RangedLoadout {
  const c = clip ?? 0
  if (c <= 0) return { ammoCurrent: 0, ammoMax: 0, reloads: 0 } // melee / no clip
  const d6 = () => Math.floor(rng() * 6) + 1
  const d3 = () => Math.floor(rng() * 3) + 1
  if (role === 'pc') return { ammoCurrent: c, ammoMax: c, reloads: d6() }
  // NPC: scarce loaded rounds (1d6-1, floored at 0) + 1d3 reloads.
  return { ammoCurrent: Math.max(0, d6() - 1), ammoMax: c, reloads: d3() }
}
