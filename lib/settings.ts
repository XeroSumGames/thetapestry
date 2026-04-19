export const SETTINGS: Record<string, string> = {
  custom: 'Custom Setting',
  district_zero: 'District Zero',
  mongrels: 'Minnie & The Magnificent Mongrels',
  chased: 'Chased',
  empty: 'Empty',
  therock: 'The Rock',
  arena: 'The Arena',
  kings_crossing_mall: "King's Crossing Mall",
}

// All settings, in the shape the create forms want.
export const SETTING_OPTIONS = Object.entries(SETTINGS).map(([value, label]) => ({ value, label }))

// Stories are short/self-contained adventure modules. /stories/new offers these.
export const STORY_SETTING_VALUES = ['custom', 'mongrels', 'chased', 'empty', 'therock', 'arena'] as const
export const STORY_SETTING_OPTIONS = STORY_SETTING_VALUES.map(v => ({ value: v, label: SETTINGS[v] }))

// Campaigns are long-running persistent worlds. /campaigns/new offers these.
export const CAMPAIGN_SETTING_VALUES = ['custom', 'district_zero', 'kings_crossing_mall'] as const
export const CAMPAIGN_SETTING_OPTIONS = CAMPAIGN_SETTING_VALUES.map(v => ({ value: v, label: SETTINGS[v] }))
