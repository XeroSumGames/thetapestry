// Shared pin-category taxonomy. Used by MapView (world map_pins) and
// CampaignPins (campaign-private campaign_pins) so the icon set stays
// in sync. If you add a category, do it here — both surfaces pick it
// up automatically.

export interface PinCategory {
  value: string
  label: string
  emoji: string
}

export const PIN_CATEGORIES: ReadonlyArray<PinCategory> = [
  { value: 'rumor',       label: 'Rumor',              emoji: '❓' },
  { value: 'location',    label: 'Location',           emoji: '📍' },
  { value: 'residence',   label: 'Residence',          emoji: '🏠' },
  { value: 'business',    label: 'Business',           emoji: '🏪' },
  { value: 'church',      label: 'Church',             emoji: '⛪' },
  { value: 'government',  label: 'Government',         emoji: '🏛️' },
  { value: 'airport',     label: 'Transport',          emoji: '✈️' },
  { value: 'hospital',    label: 'Hospital',           emoji: '🏥' },
  { value: 'military',    label: 'Military',           emoji: '⚔️' },
  { value: 'person',      label: 'Person',             emoji: '👤' },
  { value: 'danger',      label: 'Danger',             emoji: '☠️' },
  { value: 'resource',    label: 'Resource',           emoji: '🎒' },
  { value: 'medical',     label: 'Medical',            emoji: '🩸' },
  { value: 'group',       label: 'Group',              emoji: '👥' },
  { value: 'animals',     label: 'Animals',            emoji: '🐾' },
  { value: 'community',   label: 'Community',          emoji: '🏘️' },
  { value: 'world_event', label: 'Distemper Timeline', emoji: '🌍' },
  { value: 'settlement',  label: 'Settlement',         emoji: '🏚️' },
]

export function getCategoryEmoji(category: string | null | undefined): string {
  return PIN_CATEGORIES.find(c => c.value === category)?.emoji ?? '📍'
}

export function getCategoryLabel(category: string | null | undefined): string {
  return PIN_CATEGORIES.find(c => c.value === category)?.label ?? 'Location'
}
