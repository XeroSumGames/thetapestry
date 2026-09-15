// Dice expression parsing + rolling for the `/r` chat command and the visual
// dice panel (Q4, 2026-09-15).
//
// WHY THIS IS NOT THE XSE ROLL PIPELINE: `useRollResolution` / `roll_log` are
// hardwired to 2d6 - dice come from rollD6() twice, the total is a fixed
// two-die sum, and getOutcome() classifies on snake-eyes / boxcars plus bands
// (<=3 Dire Failure, <=8 Failure, <=13 Success) that are only meaningful for
// 2d6+mods. `roll_log` has no die-size column at all, so a d20 stored in die1
// is indistinguishable from a d6 and would render as a scored XSE roll (see
// FeedColumn's `isDiceRow = die1>0||die2>0`, which would hang a GM Award
// overlay off it). So arbitrary dice ride the chat path instead, exactly as
// `/r` always has. Xero's spec is explicit that the panel is ADDITIVE
// alongside `/r`, not a replacement - both share the code below so they can
// never drift apart.

/** Safety guards, unchanged from the original inline `/r` implementation. */
export const MAX_DICE = 100
export const MAX_SIDES = 1000

/** Die faces offered by the visual panel: "1d3 through 1d20" per Xero's spec. */
export const DICE_PANEL_SIDES = [3, 4, 6, 8, 10, 12, 20] as const

export type ParsedDice = { count: number; sides: number; modifier: number }

export type DiceRoll = ParsedDice & {
  rolls: number[]
  sum: number
  total: number
  /** Pretty expression, e.g. "3d20+3". */
  expr: string
  /** The chat line, e.g. "🎲 3d20+3 → [5+12+1] +3 = 21". */
  text: string
}

/**
 * Match `/r <expr>` or `/roll <expr>`, returning the raw expression tail.
 * Returns null when the line is not a roll command at all (so the caller can
 * fall through to normal chat).
 */
export function matchRollCommand(trimmed: string): string | null {
  const m = trimmed.match(/^\/r(?:oll)?\s+(.+)$/i)
  return m ? m[1] : null
}

/**
 * Parse `NdM` with any number of trailing +/- modifiers. Whitespace anywhere
 * is ignored. Returns null when malformed - the caller surfaces that inline
 * (never via alert(); browser dialogs are banned repo-wide).
 *
 * Clamps match the original `/r` behaviour exactly, including the sides floor
 * of 2 (so "1d1" rolls 1d2). Kept deliberately rather than "fixed", because
 * changing it would silently alter results for anyone already typing it.
 */
export function parseDiceExpression(raw: string): ParsedDice | null {
  const expr = raw.replace(/\s+/g, '')
  const m = expr.match(/^(\d+)d(\d+)((?:[+\-]\d+)*)$/i)
  if (!m) return null
  const count = Math.min(MAX_DICE, Math.max(1, parseInt(m[1], 10)))
  const sides = Math.min(MAX_SIDES, Math.max(2, parseInt(m[2], 10)))
  let modifier = 0
  for (const mm of (m[3] ?? '').matchAll(/([+\-])(\d+)/g)) {
    modifier += (mm[1] === '+' ? 1 : -1) * parseInt(mm[2], 10)
  }
  return { count, sides, modifier }
}

/** "3d20+3" / "1d6" - the human-readable form of a parsed expression. */
export function formatDiceExpr({ count, sides, modifier }: ParsedDice): string {
  if (modifier === 0) return `${count}d${sides}`
  return `${count}d${sides}${modifier > 0 ? '+' : ''}${modifier}`
}

/**
 * Roll a parsed expression. `rng` is injectable so tests are deterministic;
 * production callers use Math.random.
 */
export function rollParsedDice(parsed: ParsedDice, rng: () => number = Math.random): DiceRoll {
  const { count, sides, modifier } = parsed
  const rolls: number[] = []
  for (let i = 0; i < count; i++) rolls.push(Math.floor(rng() * sides) + 1)
  const sum = rolls.reduce((a, b) => a + b, 0)
  const total = sum + modifier
  const expr = formatDiceExpr(parsed)
  const modStr = modifier === 0 ? '' : modifier > 0 ? ` +${modifier}` : ` ${modifier}`
  return { count, sides, modifier, rolls, sum, total, expr, text: `🎲 ${expr} → [${rolls.join('+')}]${modStr} = ${total}` }
}

/** Parse + roll in one step. Returns null when the expression is malformed. */
export function rollDiceExpression(raw: string, rng: () => number = Math.random): DiceRoll | null {
  const parsed = parseDiceExpression(raw)
  return parsed ? rollParsedDice(parsed, rng) : null
}

/** The inline help shown when someone types a malformed `/r`. */
export const DICE_FORMAT_HINT = 'Format: /r NdM[+/-K] - e.g. /r 1d6, /r 3d20+3+2-1, /r 1d100-2'
