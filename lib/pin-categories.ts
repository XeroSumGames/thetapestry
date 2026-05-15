// Shared pin-category taxonomy. Used by MapView (world map_pins) and
// CampaignPins (campaign-private campaign_pins) so the icon set stays
// in sync. If you add a category, do it here — both surfaces pick it
// up automatically.

export interface PinCategory {
  value: string
  label: string
  emoji: string
}

// Order also drives the picker grid (9 columns × 2 rows = 18 cells).
// Row 1 (1-9) = locations & structures. Row 2 (10-18) = people &
// things, with person + group leading per Xero's 2026-05-15 call.
// 'airport' / Transport was removed 2026-05-15 (no transport hubs in
// canon); 'camp' takes its slot in row 1.
export const PIN_CATEGORIES: ReadonlyArray<PinCategory> = [
  // ── Row 1 — locations & structures ──
  { value: 'rumor',       label: 'Rumor',              emoji: '❓' },
  { value: 'location',    label: 'Location',           emoji: '📍' },
  { value: 'residence',   label: 'Residence',          emoji: '🏠' },
  { value: 'camp',        label: 'Camp',               emoji: '🏕️' },
  { value: 'business',    label: 'Business',           emoji: '🏪' },
  { value: 'church',      label: 'Church',             emoji: '⛪' },
  { value: 'government',  label: 'Government',         emoji: '🏛️' },
  { value: 'hospital',    label: 'Hospital',           emoji: '🏥' },
  { value: 'military',    label: 'Military',           emoji: '⚔️' },
  // ── Row 2 — people & things (person + group lead) ──
  { value: 'person',      label: 'Person',             emoji: '👤' },
  { value: 'group',       label: 'Group',              emoji: '👥' },
  { value: 'danger',      label: 'Danger',             emoji: '☠️' },
  { value: 'encounter',   label: 'Encounter',          emoji: '⚡' },
  { value: 'resource',    label: 'Resource',           emoji: '🎒' },
  { value: 'medical',     label: 'Medical',            emoji: '🩸' },
  { value: 'animals',     label: 'Animals',            emoji: '🐾' },
  { value: 'community',   label: 'Community',          emoji: '🏘️' },
  { value: 'world_event', label: 'Distemper Timeline', emoji: '🌍' },
  // ── Row 3 — overflow ──
  { value: 'settlement',  label: 'Settlement',         emoji: '🏚️' },
]

export function getCategoryEmoji(category: string | null | undefined): string {
  return PIN_CATEGORIES.find(c => c.value === category)?.emoji ?? '📍'
}

export function getCategoryLabel(category: string | null | undefined): string {
  return PIN_CATEGORIES.find(c => c.value === category)?.label ?? 'Location'
}

// Categories needing a CSS-filter recolor of their emoji glyph. Emoji
// can't be tinted via `color:` (they paint as images), but filter
// chains flatten the glyph to a solid color reliably enough across
// Windows / macOS / Linux emoji fonts. Mapping returns the FULL CSS
// filter string or null for "leave alone." Callers spread
// `{ filter: <string>, display: 'inline-block' }` into the emoji
// span's style, or wrap raw HTML via wrapCategoryEmojiHtml.
//
//  - group / person: 👥 / 👤 paint as muted purple silhouettes on
//    Windows. brightness(0) + invert(1) flattens to pure white.
//  - animals: 🐾 paws tinted #c0392b (distemper red) for visual punch.
//    Filter chain derived from a black silhouette → CSS-filter-to-hex
//    recipe; matches close enough across platforms.
const CATEGORY_FILTER: Record<string, string> = {
  group: 'brightness(0) invert(1)',
  person: 'brightness(0) invert(1)',
  animals: 'brightness(0) saturate(100%) invert(20%) sepia(85%) saturate(2200%) hue-rotate(354deg) brightness(95%) contrast(95%)',
}

export function getCategoryFilter(category: string | null | undefined): string | null {
  if (!category) return null
  return CATEGORY_FILTER[category] ?? null
}

// Back-compat: kept so existing callers that ask "should I apply the
// white filter?" still work. Now also covers categories whose filter
// is the white-flatten string (group, person). Animals returns false
// here even though it HAS a filter — callers checking this helper
// won't tint animals red. Prefer getCategoryFilter() for new code.
export function categoryNeedsWhiteFilter(category: string | null | undefined): boolean {
  return getCategoryFilter(category) === 'brightness(0) invert(1)'
}

export function wrapCategoryEmojiHtml(category: string | null | undefined, emoji: string): string {
  const filter = getCategoryFilter(category)
  return filter
    ? `<span style="filter:${filter};display:inline-block;line-height:1;">${emoji}</span>`
    : emoji
}
