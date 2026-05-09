/**
 * Parse and roll XSE damage strings like "5+2d6", "3+1d3", "+1", "2", "1d3+PHY"
 */

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
 * Calculate final damage after defensive modifier and RP.
 *
 * Canon (locked 2026-05-09): for `Stun`-tagged weapons (Taser,
 * Cattle Prod), RP is computed from RAW WP, not mitigated WP. The
 * stun's whole purpose is to deal RP - the impact rocks the body
 * even when the wound itself was deflected. Without `rpFromRaw`,
 * a Taser hit on anyone with DEX>=1 collapses to 0/0 because
 * mitigation zeroes WP and the cascade kills RP too. Pass
 * `rpFromRaw: true` when the attacking weapon's traits include
 * `Stun` (and when adding any future weapon whose RP is meant to
 * apply regardless of mitigation, e.g. concussion grenades). For
 * all other weapons, RP scales with mitigated WP per the standard
 * SRD damage flow.
 */
export function calculateDamage(
  rawWP: number,
  rpPercent: number,
  defensiveModifier: number,
  options?: { rpFromRaw?: boolean }
): {
  finalWP: number
  finalRP: number
  mitigated: number
} {
  const mitigated = Math.max(0, defensiveModifier)
  const finalWP = Math.max(0, rawWP - mitigated)
  const rpSource = options?.rpFromRaw ? rawWP : finalWP
  const finalRP = Math.floor(rpSource * (rpPercent / 100))
  return { finalWP, finalRP, mitigated }
}
