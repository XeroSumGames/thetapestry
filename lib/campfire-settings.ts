// lib/campfire-settings.ts
// Shared helpers for the Phase 4A per-setting feed layer. Picker options
// (used in compose dropdowns) and filter-chip options (used in reader chip
// strips) for the three Campfire surfaces — forum_threads, war_stories,
// lfg_posts. Single source of truth so we don't drift across the three
// pages.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { SETTINGS } from './settings'

// Settings that get a dedicated filter chip + are the "live" promoted
// settings on the platform. These are the ones with full canon + setting
// hubs (Phase 4C will surface them at /settings/[setting]).
//
// Order here matters — these render in this order on chip strips and at
// the top of the picker dropdown.
export const FEATURED_SETTING_SLUGS = [
  'district_zero',
  'kings_crossroads_mall',
] as const

// Per-chip accent color so the chip strips are scannable. Reuses the
// existing brand palette — DZ = teal-blue (matches the DZ sourcebook),
// Kings Crossroads = warm orange (matches the Chased mall pin set).
export const SETTING_ACCENT: Record<string, string> = {
  district_zero: '#7ab3d4',
  kings_crossroads_mall: '#EF9F27',
  // Fallback for non-featured settings — used when older content is
  // tagged with a deprecated slug (chased, mongrels, etc.).
  __default__: '#9aa5b0',
}

export function settingLabel(slug: string | null | undefined): string {
  if (!slug) return 'Global'
  return SETTINGS[slug] ?? slug
}

export function settingAccent(slug: string | null | undefined): string {
  if (!slug) return '#cce0f5'
  return SETTING_ACCENT[slug] ?? SETTING_ACCENT.__default__
}

// Options for the compose-time setting picker. Featured slugs first
// (DZ + Kings Crossroads), then the rest of SETTINGS in alphabetical
// order — minus `custom`, which is per-campaign and doesn't make sense
// as a cross-campaign setting tag.
export function composePickerOptions(): { value: string; label: string }[] {
  const featured = FEATURED_SETTING_SLUGS.map(slug => ({ value: slug, label: SETTINGS[slug] ?? slug }))
  const rest = Object.entries(SETTINGS)
    .filter(([slug]) => slug !== 'custom' && !FEATURED_SETTING_SLUGS.includes(slug as any))
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([value, label]) => ({ value, label }))
  return [...featured, ...rest]
}

// Filter-chip strip for reader pages. "All" first, then the featured
// slugs. We deliberately don't render a chip per deprecated setting —
// posts tagged with those slugs only show in "All" until/if a chip is
// added. Keeps the strip from sprawling.
export interface FilterChipOption {
  value: string | null  // null = "All"; '' (empty) = "Global"; <slug> = setting
  label: string
  accent: string
}

export const SETTING_FILTER_CHIPS: FilterChipOption[] = [
  { value: null, label: 'All', accent: '#f5f2ee' },
  ...FEATURED_SETTING_SLUGS.map(slug => ({
    value: slug,
    label: SETTINGS[slug] ?? slug,
    accent: SETTING_ACCENT[slug],
  })),
  { value: '', label: 'Global', accent: '#9aa5b0' },
]

// Apply a setting filter to a list of rows. `null` = no filter (show all).
// `''` (empty string) = global only (rows where setting IS NULL).
// `<slug>` = exact slug match.
export function applySettingFilter<T extends { setting?: string | null }>(
  rows: T[],
  filter: string | null,
): T[] {
  if (filter === null) return rows
  if (filter === '') return rows.filter(r => !r.setting)
  return rows.filter(r => r.setting === filter)
}

// URL-driven setting filter. The /campfire hub renders a single setting
// dropdown that writes ?setting=<slug>; each embedded surface reads it
// here so picking a context on the hub propagates to forums, war stories,
// and LFG simultaneously.
//
// Param values:
//   missing     → null  (All settings)
//   "global"    → ''    (Global-only — rows with setting IS NULL)
//   <slug>      → <slug> (single setting)
//
// The `[settingFilter, setSettingFilter]` returned here is local React
// state — we don't push back to the URL on chip clicks (that would fight
// the hub dropdown). The hub is the writer, the surfaces are readers.
// This preserves "click a chip on Forums to filter just Forums without
// affecting the hub context" behavior.
export function useUrlSettingFilter(): [string | null, (v: string | null) => void] {
  const sp = useSearchParams()
  const param = sp?.get('setting')
  // Translate URL param → local-filter shape ("global" → '', slug → slug,
  // missing → null). Any unknown value falls through as-is so manually
  // typed slugs still work.
  const fromUrl = param == null ? null : (param === 'global' ? '' : param)
  const [filter, setFilter] = useState<string | null>(fromUrl)
  // Re-sync when the URL changes (hub dropdown updates while the surface
  // is mounted). The dependency on `param` covers ?setting= edits.
  useEffect(() => { setFilter(fromUrl) }, [param])
  return [filter, setFilter]
}
