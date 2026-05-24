/**
 * Parse and roll XSE damage strings like "5+2d6", "3+1d3", "+1", "2", "1d3+PHY"
 */
import { trace } from './playtest-recorder'

function rollDice(count: number, sides: number): number {
  let total = 0
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * sides) + 1
  }
  return total
}

/**
 * Parse a damage string and roll it.
 * Examples: "5+2d6" → 5 + roll(2d6), "3+1d3" → 3 + roll(1d3), "+1" → 1, "2" → 2
 * Returns the individual components for display.
 */
export function rollDamage(damageStr: string, phyAmod = 0, isMelee = false): {
  base: number
  diceRoll: number
  diceDesc: string
  phyBonus: number
  totalWP: number
} {
  let base = 0
  let diceRoll = 0
  let diceDesc = ''

  // Handle "+1" format (Brass Knuckles)
  if (damageStr.match(/^\+?\d+$/) && !damageStr.includes('d')) {
    base = parseInt(damageStr.replace('+', ''), 10)
  } else {
    // Parse "X+YdZ" or "YdZ"
    const match = damageStr.match(/^(\d+)?\+?(\d+)d(\d+)$/)
    if (match) {
      base = match[1] ? parseInt(match[1], 10) : 0
      const count = parseInt(match[2], 10)
      const sides = parseInt(match[3], 10)
      diceRoll = rollDice(count, sides)
      diceDesc = `${count}d${sides}`
    }
  }

  const phyBonus = isMelee ? phyAmod : 0
  const totalWP = base + diceRoll + phyBonus

  return { base, diceRoll, diceDesc, phyBonus, totalWP }
}

/**
 * Calculate final damage after defensive modifier, armor, and RP.
 *
 * Canon (locked 2026-05-09):
 *
 * 1. Stun-tagged weapons (Taser, Cattle Prod) compute RP from
 *    RAW WP, not mitigated WP. The stun's whole purpose is to
 *    deal RP - the impact rocks the body even when the wound is
 *    deflected. Pass `rpFromRaw: true` when the attacking weapon's
 *    traits include `Stun` (or any future weapon whose RP should
 *    apply regardless of mitigation).
 *
 * 2. Armor DMs stack additively with the defender's PHY/DEX
 *    defensive modifier. Pass the defender's currently-worn armor
 *    via `armor`. Pieces tagged `reactive_melee_only` (Riot Shield)
 *    only contribute when `attackerCategory` is `melee` or
 *    `unarmed` - a bullet ignores the shield entirely. See
 *    `lib/xse-schema.ts:ARMOR` for the canonical armor catalog
 *    and `tasks/rules-extract-armor-explosives.md` for the spec.
 *
 * `mitigated` in the return value is the FINAL summed defensive
 * value (PHY/DEX + applicable armor DMs) - useful for log
 * narration ("3 mitigated").
 */
export interface ArmorPiece {
  dm: number
  reactive_melee_only?: boolean
}

export type AttackerCategory = 'melee' | 'unarmed' | 'ranged' | 'explosive' | 'heavy'

export function calculateDamage(
  rawWP: number,
  rpPercent: number,
  defensiveModifier: number,
  options?: {
    rpFromRaw?: boolean
    armor?: ArmorPiece[]
    attackerCategory?: AttackerCategory
  }
): {
  finalWP: number
  finalRP: number
  mitigated: number
} {
  const isMeleeOrUnarmed = options?.attackerCategory === 'melee' || options?.attackerCategory === 'unarmed'
  const armorDm = (options?.armor ?? []).reduce((sum, piece) => {
    if (piece.reactive_melee_only && !isMeleeOrUnarmed) return sum
    return sum + Math.max(0, piece.dm)
  }, 0)
  const mitigated = Math.max(0, defensiveModifier) + armorDm
  const finalWP = Math.max(0, rawWP - mitigated)
  const rpSource = options?.rpFromRaw ? rawWP : finalWP
  const finalRP = Math.floor(rpSource * (rpPercent / 100))
  // Diagnostic - playtest 2026-05-11 belt-and-suspenders trace inside
  // calculateDamage itself, so the math is captured no matter which
  // caller invoked it (table page, vehicle popout, future paths). The
  // call-site trace in table/page.tsx around line 4390 has caller
  // context; this one guarantees the raw-math ingredients are in the
  // recorder dump for every damage call.
  // Prefix [playtest-trace] matches the rest of the 5/11 instrumentation
  // so all traces are greppable together in DevTools.
  trace('damage', {
    rawWP, rpPercent, defensiveModifier,
    armorDm, mitigated,
    finalWP, finalRP,
    rpFromRaw: !!options?.rpFromRaw,
    attackerCategory: options?.attackerCategory ?? null,
  })
  return { finalWP, finalRP, mitigated }
}
