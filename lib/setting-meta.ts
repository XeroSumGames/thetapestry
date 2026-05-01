// lib/setting-meta.ts
// Per-setting display metadata for the Phase 4C setting hubs at
// /settings/[setting]. SETTINGS in lib/settings.ts has only the slug →
// label map; this file extends it with hub-page taglines + accent colors
// keyed off the same slugs.
//
// Featured slugs (the ones with full hubs in 4C) are District Zero +
// Kings Crossroads. Other slugs may eventually get hubs of their own;
// today they fall through to the lookup-or-default helpers.

import { SETTINGS } from './settings'

export interface SettingMeta {
  /** Short subtitle rendered under the name on the hub header. */
  tagline: string
  /** Longer prose description rendered below the tagline. */
  blurb: string
  /** Brand-accent color for the hub header + chips. */
  accent: string
  /** Default map zoom when "View on map" links land on the hub's region. */
  mapZoom: number
  /** Center the map flies to when there's no specific pin to focus on. */
  mapCenter: { lat: number; lng: number }
}

const SETTING_META: Record<string, SettingMeta> = {
  district_zero: {
    tagline: 'East Tulsa, Oklahoma. The District holds.',
    blurb:
      'Built behind the husks of Broken Arrow, District Zero is the largest fortified survivor settlement in the western Distemperverse. Four gates, the Farm beyond the eastern wall, and the long-running tension between the Council, the Sheriff’s Office, and whoever’s holding the Watchtower this week.',
    accent: '#7ab3d4',
    mapZoom: 14,
    mapCenter: { lat: 36.0510, lng: -95.7900 },
  },
  kings_crossroads_mall: {
    tagline: 'Sussex County, Delaware. A mall complex on the edge of nowhere.',
    blurb:
      'Kings Crossroads is the persistent setting in the Chased magazine — a reclaimed strip-mall and motel cluster off the Delaware highway. Best Nite Motel, Belvedere’s, the Costco, the gas station. Eight known locations, a working community, and trouble that arrives by car.',
    accent: '#EF9F27',
    mapZoom: 16,
    mapCenter: { lat: 38.6958, lng: -75.5135 },
  },
}

/** Returns true when the setting has a featured hub at /settings/[setting]. */
export function hasSettingHub(slug: string | null | undefined): boolean {
  return !!slug && slug in SETTING_META
}

/** Pull the meta block for a slug. Returns null if the slug isn't featured. */
export function getSettingMeta(slug: string): SettingMeta | null {
  return SETTING_META[slug] ?? null
}

/** Display label, falling back to the slug if SETTINGS has no entry. */
export function settingDisplayName(slug: string): string {
  return SETTINGS[slug] ?? slug
}

/** All featured slugs — drives the sidebar + "all hubs" lists. */
export const FEATURED_HUB_SLUGS: readonly string[] = Object.keys(SETTING_META)
