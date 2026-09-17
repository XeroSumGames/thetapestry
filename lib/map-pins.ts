// Shared map-pin shapes and constants.
//
// Exists to break an import cycle: components/MapView.tsx renders
// components/PinsPanel.tsx, so the panel must not import back up into MapView
// for the types and constants they both need (dependency-cruiser's no-circular
// rule catches it, and TIMELINE_STEP_MS is a value import, so it would be a
// genuine runtime cycle rather than a type-only one). Both now import from here.
// Extracted 2026-09-16 during Phase 0.3.

export interface Pin {
  id: string
  lat: number
  lng: number
  title: string
  notes: string
  pin_type: string
  status: string
  user_id: string
  category: string
  categories?: string[]
  created_at?: string
  sort_order?: number
  event_date?: string | null
  address?: string | null
  // Parent/child structure - null for top-level pins, references
  // another map_pins.id for sub-rumors (e.g. "the basement" hanging
  // off "the abandoned warehouse"). FK is ON DELETE SET NULL so a
  // deleted parent orphans its children rather than cascading.
  parent_pin_id?: string | null
}

/**
 * How long the World Events timeline walkthrough rests on each pin before
 * flying to the next. MapView drives the walk; PinsPanel shows the interval in
 * its play-button tooltip.
 */
export const TIMELINE_STEP_MS = 10000
