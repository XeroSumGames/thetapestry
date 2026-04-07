export const SETTINGS: Record<string, string> = {
  custom: 'New Setting',
  district_zero: 'District Zero',
  mongrels: 'Minnie & The Magnificent Mongrels',
  chased: 'Chased',
  empty: 'Empty',
  therock: 'The Rock',
}

export const SETTING_OPTIONS = Object.entries(SETTINGS).map(([value, label]) => ({ value, label }))
