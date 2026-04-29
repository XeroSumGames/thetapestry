export const SETTINGS: Record<string, string> = {
  custom: 'Custom Setting',
  district_zero: 'District Zero',
  mongrels: 'Minnie & The Magnificent Mongrels',
  chased: 'Chased',
  empty: 'Empty',
  therock: 'The Rock',
  arena: 'The Arena',
  // Real-world Delaware location: Kings Crossroads is an unincorporated
  // community in Sussex County. The DB value `kings_crossroads_mall`
  // refers to the mall scenario AT Kings Crossroads (older rows used
  // "kings_crossing_mall" — see sql/setting-rename-kings-crossroads.sql).
  // Label shows just the geographic name on the New Story picker; the
  // mall is implicit (it's the only published setting at that location).
  kings_crossroads_mall: 'Kings Crossroads',
}

// All settings, in the shape the create forms want.
export const SETTING_OPTIONS = Object.entries(SETTINGS).map(([value, label]) => ({ value, label }))

// Story creation surface. The legacy "Stories vs Campaigns" split is
// being collapsed: there's now only one creation flow at /stories/new,
// and the "Story" terminology covers both ad-hoc one-shots and
// long-running persistent worlds. Settings are deliberately limited
// — Chased, Mongrels, Empty, The Rock, and The Arena are moving to
// the Module marketplace instead, where Thrivers can publish them
// (some free, some paid) and players can install them with one click.
export const STORY_SETTING_VALUES = ['custom', 'district_zero', 'kings_crossroads_mall'] as const
export const STORY_SETTING_OPTIONS = STORY_SETTING_VALUES.map(v => ({ value: v, label: SETTINGS[v] }))

// Legacy alias — the /campaigns/new flow is being retired but a few
// internal references still import this name. Same list as
// STORY_SETTING_OPTIONS now; can be removed once those callers are
// migrated.
export const CAMPAIGN_SETTING_VALUES = STORY_SETTING_VALUES
export const CAMPAIGN_SETTING_OPTIONS = STORY_SETTING_OPTIONS
