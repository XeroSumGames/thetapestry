/**
 * Create a test character via Supabase.
 *
 * Usage from the browser console while logged in:
 *   1. Open any page on The Tapestry
 *   2. Open browser DevTools (F12) → Console
 *   3. Paste the contents of this script
 *   4. Call: createTestCharacter()
 *
 * Or run via the app by importing this function.
 */

const TEST_CHARACTER = {
  name: 'Cruz Zwick',
  age: '34',
  gender: 'Male',
  height: '5\'10"',
  weight: '175 lbs',
  profession: 'Military',
  concept: 'A battle-hardened former soldier trying to find purpose in the aftermath. Likes ice cream',
  physdesc: 'Weathered face, close-cropped dark hair, a jagged scar running from his left ear to his jaw. Has a weird tic',
  photoDataUrl: '',
  threeWords: ['Stoic', 'Resourceful', 'Haunted'],
  creationMethod: 'backstory' as const,

  rapid: { RSN: 1, ACU: 2, PHY: 1, INF: 0, DEX: 1 },

  skills: [
    { skillName: 'Ranged Combat', level: 3 },
    { skillName: 'Athletics', level: 3 },
    { skillName: 'Melee Combat', level: 2 },
    { skillName: 'Tactics', level: 1 },
    { skillName: 'Stealth', level: 1 },
    { skillName: 'Survival', level: 1 },
    { skillName: 'Navigation', level: 1 },
    { skillName: 'Heavy Weapons', level: 1 },
    { skillName: 'Scavenger', level: 1 },
  ],

  secondary: {
    woundPoints: 12,    // 10 + PHY(1) + DEX(1)
    resiliencePoints: 7, // 6 + PHY(1)
    rangedDefense: 1,    // DEX
    meleeDefense: 1,     // PHY
    initiative: 3,       // DEX + ACU
    encumbrance: 7,      // 6 + PHY
    perception: 3,       // RSN + ACU
    stressModifier: 3,   // RSN + ACU
    morality: 3,
  },

  complication: 'Loss',
  motivation: 'Protect',

  weaponPrimary: { weaponName: 'Assault Rifle', skill: 'Ranged Combat', range: 'Long', rarity: 'Uncommon', damage: '5+2d6', rpPercent: '50%', enc: 2, ammo: 'Uncommon', ammoCount: 30, traits: 'Automatic Burst (3)' },
  weaponSecondary: { weaponName: 'Combat Knife', skill: 'Melee Combat', range: 'Engaged', rarity: 'Common', damage: '3+1d3', rpPercent: '50%', enc: 1, traits: '' },

  equipment: ['Backpack'],
  incidentalItem: 'Dog tags from his unit',
  rations: 'Standard',

  insightDice: 2,
  cdp: 0,
  stressLevel: 0,
  breakingPoint: 0,
  lastingWounds: [],
  notes: '',
}

export async function createTestCharacter(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { console.error('Not logged in'); return }

  const { data, error } = await supabase.from('characters').insert({
    user_id: user.id,
    name: TEST_CHARACTER.name,
    data: TEST_CHARACTER,
  }).select().single()

  if (error) {
    console.error('Error creating test character:', error.message)
    return
  }
  console.log('Test character created:', data.id, TEST_CHARACTER.name)
  return data
}

export async function createMultipleTestCharacters(supabase: any, count: number) {
  const firstNames = ['Marcus', 'Delia', 'Rourke', 'Tess', 'Callum', 'Nadia', 'Silas', 'Freya', 'Wade', 'Sloane']
  const lastNames = ['Graves', 'Voss', 'Mercer', 'Crane', 'Holloway', 'Frost', 'Holt', 'Pike', 'Shaw', 'Thorne']

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { console.error('Not logged in'); return }

  const results = []
  for (let i = 0; i < count; i++) {
    const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`
    const char = { ...TEST_CHARACTER, name }
    const { data, error } = await supabase.from('characters').insert({
      user_id: user.id,
      name,
      data: char,
    }).select().single()
    if (error) { console.error(`Error creating ${name}:`, error.message); continue }
    console.log(`Created: ${name} (${data.id})`)
    results.push(data)
  }
  return results
}
