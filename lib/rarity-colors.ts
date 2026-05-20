// Canonical rarity color palette.
//
// LOCKED 2026-05-09 by Xero. Every surface that renders a rarity chip,
// label, or border MUST use these colors verbatim. Don't reintroduce
// the older amber-Rare or grey-Common variants - they were inconsistent
// across the wizard / inventory / rules tables, and Xero unified the
// scheme to:
//
//   Common    light green    #7fc458   (matches "SURVIVORS PRESENT")
//   Uncommon  blue           #7ab3d4
//   Rare      purple         #c4a7f0
//
// `RARITY_COLOR` returns the foreground / text color - the canonical
// per-rarity value. `RARITY_BG` and `RARITY_BORDER` are subtle chip
// backgrounds matched to each foreground for use on dark surfaces.
//
// AGENTS.md mirrors this rule under UI conventions.

export type Rarity = 'Common' | 'Uncommon' | 'Rare'

export const RARITY_COLOR: Record<Rarity, string> = {
  Common: '#7fc458',
  Uncommon: '#7ab3d4',
  Rare: '#c4a7f0',
}

export const RARITY_BG: Record<Rarity, string> = {
  Common: '#1a2e10',
  Uncommon: '#0f1f30',
  Rare: '#1a142a',
}

export const RARITY_BORDER: Record<Rarity, string> = {
  Common: '#2d5a1b',
  Uncommon: '#2a4a6b',
  Rare: '#3e2e5a',
}

/** Lookup with a fallback to the muted text color when the input
 *  isn't a known rarity (legacy data, unset fields, etc.). */
export function rarityColor(rarity: string | null | undefined): string {
  if (!rarity) return '#cce0f5'
  return (RARITY_COLOR as Record<string, string>)[rarity] ?? '#cce0f5'
}

export function rarityBg(rarity: string | null | undefined): string {
  if (!rarity) return '#242424'
  return (RARITY_BG as Record<string, string>)[rarity] ?? '#242424'
}

export function rarityBorder(rarity: string | null | undefined): string {
  if (!rarity) return '#3a3a3a'
  return (RARITY_BORDER as Record<string, string>)[rarity] ?? '#3a3a3a'
}
