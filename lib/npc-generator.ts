import { MELEE_WEAPONS, RANGED_WEAPONS, Weapon } from './weapons'

// ── Name Lists ──

const MALE_NAMES = [
  'Marcus', 'Callum', 'Rourke', 'Ezra', 'Silas', 'Wade', 'Donovan', 'Fletcher', 'Hector', 'Jasper',
  'Knox', 'Levi', 'Milo', 'Nolan', 'Oscar', 'Pierce', 'Quinn', 'Reed', 'Sawyer', 'Thane',
  'Victor', 'Warren', 'Wyatt', 'Axel', 'Barrett', 'Cole', 'Dalton', 'Emmett', 'Finn', 'Garrett',
  'Hugo', 'Ivan', 'Jude', 'Kane', 'Luther', 'Marshall', 'Nash', 'Owen', 'Palmer', 'Rhett',
  'Sterling', 'Tucker', 'Vance', 'Wesley', 'Xander', 'Yuri', 'Zane', 'Brandt', 'Clay', 'Dean',
]

const FEMALE_NAMES = [
  'Delia', 'Tess', 'Nadia', 'Sloane', 'Maren', 'Freya', 'Ilsa', 'Petra', 'Vera', 'Wren',
  'Ada', 'Blair', 'Cleo', 'Darcy', 'Elowen', 'Faye', 'Gemma', 'Harper', 'Iris', 'Juno',
  'Kiera', 'Lena', 'Maeve', 'Nell', 'Opal', 'Phoebe', 'Rae', 'Sable', 'Tara', 'Uma',
  'Violet', 'Willa', 'Xena', 'Yara', 'Zara', 'Astrid', 'Briar', 'Cassidy', 'Dagne', 'Elara',
  'Fern', 'Greta', 'Hadley', 'Ingrid', 'Jules', 'Kenna', 'Lyra', 'Miriam', 'Nora', 'Olive',
]

const NEUTRAL_NAMES = [
  'Rowan', 'Avery', 'Morgan', 'Casey', 'River', 'Ellis', 'Sage', 'Reese', 'Jordan', 'Dakota',
  'Phoenix', 'Lennox', 'Emery', 'Harley', 'Skyler', 'Shiloh', 'Finley', 'Remy', 'Sutton', 'Tatum',
  'Blake', 'Cameron', 'Drew', 'Elliot', 'Frankie', 'Gray', 'Hayden', 'Indigo', 'Jamie', 'Kai',
  'Lane', 'Marlowe', 'Nico', 'Oakley', 'Parker', 'Quinn', 'Robin', 'Scout', 'Taylor', 'Val',
  'Winter', 'Ash', 'Bay', 'Corin', 'Dale', 'Eden', 'Flynn', 'Glen', 'Hart', 'Jesse',
]

const LAST_NAMES = [
  'Graves', 'Blackwood', 'Voss', 'Mercer', 'Crane', 'Holloway', 'Ashford', 'Beckett', 'Carver', 'Delaney',
  'Frost', 'Gallagher', 'Holt', 'Irons', 'Kemp', 'Lowe', 'Monroe', 'Nash', 'Oakes', 'Pike',
  'Raines', 'Shaw', 'Thorne', 'Underwood', 'Vega', 'Walsh', 'York', 'Abbott', 'Bannon', 'Cross',
  'Dunne', 'Ellison', 'Farrow', 'Grant', 'Hayes', 'Jarvis', 'Kendrick', 'Lang', 'Mack', 'Norris',
  'Ortega', 'Price', 'Rawlins', 'Stone', 'Torres', 'Vale', 'Ward', 'Xiong', 'Young', 'Ziegler',
  'Brennan', 'Caffrey', 'Dawson', 'Enright', 'Foley', 'Gibson', 'Harding', 'Ingram', 'Jansen', 'Keller',
  'Lockhart', 'Marsh', 'Novak', 'Pace', 'Reeves', 'Salazar', 'Trask', 'Upton', 'Vasquez', 'Webb',
  'Adler', 'Boone', 'Chandler', 'Drake', 'Everett', 'Finch', 'Glenn', 'Hull', 'Ives', 'Judd',
  'Knoll', 'Lawson', 'Morrow', 'Neal', 'Osborn', 'Penn', 'Ridge', 'Stark', 'Trent', 'Usher',
  'Vincent', 'Weston', 'Xavier', 'Yates', 'Zimmerman', 'Cole', 'Burke', 'Doyle', 'Flynn', 'Heath',
]

// ── Professions & Skill Pools ──

const PROFESSIONS = [
  'Academic', 'Driver', 'Entrepreneur', 'Law Enforcement',
  'Mechanic', 'Medic', 'Military', 'Outdoorsman',
  'Outlaw', 'Performer', 'Politician', 'Trader',
]

const PROFESSION_SKILLS: Record<string, string[]> = {
  Academic: ['Research', 'Medicine', 'Psychology', 'Navigation', 'Inspiration'],
  Driver: ['Driving', 'Mechanic', 'Navigation', 'Streetwise', 'Survival'],
  Entrepreneur: ['Barter', 'Manipulation', 'Inspiration', 'Streetwise', 'Entertainment'],
  'Law Enforcement': ['Ranged Combat', 'Melee Combat', 'Streetwise', 'Psychology', 'Athletics'],
  Mechanic: ['Mechanic', 'Tinkerer', 'Weaponsmith', 'Driving', 'Demolitions'],
  Medic: ['Medicine', 'Research', 'Psychology', 'Survival', 'Inspiration'],
  Military: ['Ranged Combat', 'Melee Combat', 'Athletics', 'Tactics', 'Heavy Weapons'],
  Outdoorsman: ['Survival', 'Athletics', 'Navigation', 'Stealth', 'Animal Handling'],
  Outlaw: ['Stealth', 'Lock-Picking', 'Sleight of Hand', 'Streetwise', 'Melee Combat'],
  Performer: ['Entertainment', 'Inspiration', 'Manipulation', 'Sleight of Hand', 'Barter'],
  Politician: ['Manipulation', 'Inspiration', 'Psychology', 'Barter', 'Intimidation'],
  Trader: ['Barter', 'Streetwise', 'Navigation', 'Scavenging', 'Manipulation'],
}

const COMBAT_SKILLS = ['Ranged Combat', 'Melee Combat', 'Unarmed Combat', 'Heavy Weapons', 'Athletics']

// ── Complications & Motivations ──

const COMPLICATIONS = [
  'Addiction', 'Betrayed', 'Code of Honor', 'Criminal Past', 'Daredevil', 'Dark Secret',
  'Family Obligation', 'Famous', 'Loss', 'Outstanding Debt', 'Personal Enemy',
]

const MOTIVATIONS = [
  'Accumulate', 'Build', 'Find Safety', 'Hedonism', 'Make Amends', 'Preach',
  'Protect', 'Reunite', 'Revenge', 'Stay Alive', 'Take Advantage',
]

// ── Personality Words ──

const PERSONALITY_WORDS = [
  'Calculating', 'Reckless', 'Stoic', 'Paranoid', 'Loyal', 'Bitter',
  'Resourceful', 'Haunted', 'Ruthless', 'Idealistic', 'Cynical', 'Protective',
  'Quiet', 'Volatile', 'Generous', 'Suspicious', 'Stubborn', 'Cunning',
  'Hopeful', 'Pragmatic', 'Vengeful', 'Patient', 'Impulsive', 'Sardonic',
  'Devout', 'Desperate', 'Defiant', 'Weary', 'Fierce', 'Compassionate',
  'Cold', 'Charming', 'Blunt', 'Cautious', 'Driven', 'Melancholy',
  'Jovial', 'Fearless', 'Guarded', 'Gruff', 'Tender', 'Obsessive',
  'Resigned', 'Ambitious', 'Humble', 'Secretive', 'Brash', 'Methodical',
  'Sentimental', 'Detached', 'Restless', 'Territorial', 'Adaptable', 'Wry',
  'Earnest', 'Sullen', 'Scrappy', 'Unflinching', 'Pensive', 'Gregarious',
]

// ── Helpers ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(n, shuffled.length))
}

function weightedPick(weights: [string, number][]): string {
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [value, weight] of weights) {
    r -= weight
    if (r <= 0) return value
  }
  return weights[weights.length - 1][0]
}

function chance(pct: number): boolean {
  return Math.random() * 100 < pct
}

// ── Generator ──

export const ALL_SKILLS = [
  'Animal Handling', 'Athletics', 'Barter', 'Demolitions*', 'Driving',
  'Entertainment', 'Farming', 'Gambling', 'Heavy Weapons*', 'Inspiration',
  'Lock-Picking*', 'Manipulation', 'Mechanic*', 'Medicine*', 'Melee Combat',
  'Navigation', 'Psychology*', 'Ranged Combat', 'Research', 'Scavenging',
  'Sleight of Hand', 'Specific Knowledge', 'Stealth', 'Streetwise', 'Survival',
  'Tactics*', 'Tinkerer', 'Unarmed Combat', 'Weaponsmith*',
]

export interface SkillEntry { name: string; level: number }

export interface GeneratedNpc {
  name: string
  npc_type: string
  gender: 'man' | 'woman'
  reason: number
  acumen: number
  physicality: number
  influence: number
  dexterity: number
  skillEntries: SkillEntry[]
  notes: string
  profession: string
  motivation: string
  complication: string
  words: string[]
  weapon?: { weaponName: string; condition: string; ammoCurrent: number; ammoMax: number; reloads: number }
}

export function generateRandomNpc(typeOverride?: string): GeneratedNpc {
  // Name + gender — 50/50 male/female. Neutral names pooled into whichever is picked.
  const gender: 'man' | 'woman' = chance(50) ? 'man' : 'woman'
  const namePool = gender === 'man' ? [...MALE_NAMES, ...NEUTRAL_NAMES] : [...FEMALE_NAMES, ...NEUTRAL_NAMES]
  const firstName = pick(namePool)
  const lastName = pick(LAST_NAMES)
  const name = `${firstName} ${lastName}`

  // Type
  const npcType = typeOverride || weightedPick([
    ['bystander', 35],
    ['goon', 35],
    ['foe', 20],
    ['antagonist', 10],
  ])

  // RAPID
  let reason = 0, acumen = 0, physicality = 0, influence = 0, dexterity = 0
  const attrs: string[] = ['reason', 'acumen', 'physicality', 'influence', 'dexterity']

  if (npcType === 'bystander') {
    if (chance(40)) {
      const bump = pick(attrs)
      if (bump === 'reason') reason = 1
      else if (bump === 'acumen') acumen = 1
      else if (bump === 'physicality') physicality = 1
      else if (bump === 'influence') influence = 1
      else dexterity = 1
    }
  } else if (npcType === 'goon') {
    if (chance(50)) physicality = 1; else dexterity = 1
    if (chance(20)) {
      const other = pick(attrs.filter(a => {
        if (a === 'physicality' && physicality > 0) return false
        if (a === 'dexterity' && dexterity > 0) return false
        return true
      }))
      if (other === 'reason') reason = 1
      else if (other === 'acumen') acumen = 1
      else if (other === 'physicality') physicality = 1
      else if (other === 'influence') influence = 1
      else dexterity = 1
    }
  } else if (npcType === 'foe') {
    acumen = 1; physicality = 1; dexterity = 1
    if (chance(30)) {
      const bump = pick(['acumen', 'physicality', 'dexterity'] as const)
      if (bump === 'acumen') acumen = 2
      else if (bump === 'physicality') physicality = 2
      else dexterity = 2
    }
  } else if (npcType === 'antagonist') {
    const values = [3, 2, 2, 1, 0]
    const shuffledAttrs = [...attrs].sort(() => Math.random() - 0.5)
    shuffledAttrs.forEach((attr, i) => {
      const v = values[i]
      if (attr === 'reason') reason = v
      else if (attr === 'acumen') acumen = v
      else if (attr === 'physicality') physicality = v
      else if (attr === 'influence') influence = v
      else dexterity = v
    })
  }

  // Profession
  const profession = pick(PROFESSIONS)
  const pool = PROFESSION_SKILLS[profession] ?? []

  // Skills based on type
  let skillEntries: { name: string; level: number }[] = []

  if (npcType === 'bystander') {
    const selected = pickN(pool, 2)
    skillEntries = selected.map(s => ({ name: s, level: 1 }))
  } else if (npcType === 'goon') {
    // Favour combat skills
    const combatFromPool = pool.filter(s => COMBAT_SKILLS.includes(s))
    const nonCombat = pool.filter(s => !COMBAT_SKILLS.includes(s))
    const combat = combatFromPool.length > 0 ? [pick(combatFromPool)] : []
    const others = pickN(nonCombat, 2)
    skillEntries = [...combat, ...others].slice(0, 3).map(s => ({ name: s, level: 1 }))
  } else if (npcType === 'foe') {
    const shuffled = pickN(pool, 5)
    skillEntries = shuffled.map((s, i) => ({ name: s, level: i < 2 ? 2 : 1 }))
  } else if (npcType === 'antagonist') {
    const shuffled = pickN(pool, Math.min(pool.length, 5))
    // Add extra combat skills if pool is small
    const extra = pickN(COMBAT_SKILLS.filter(s => !shuffled.includes(s)), 6 - shuffled.length)
    const allSkills = [...shuffled, ...extra].slice(0, 6)
    const levels = [3, 2, 2, 1, 1, 1]
    skillEntries = allSkills.map((s, i) => ({ name: s, level: levels[i] ?? 1 }))
  }

  // Complication & Motivation
  const complication = pick(COMPLICATIONS)
  const motivation = pick(MOTIVATIONS)

  // Three words
  const words = pickN(PERSONALITY_WORDS, 3)

  // GM Notes
  const notes = `Generated as ${profession}.`

  // Weapon assignment by type
  let weapon: GeneratedNpc['weapon'] = undefined
  if (npcType === 'goon') {
    // Common melee or common ranged
    const commonMelee = MELEE_WEAPONS.filter(w => w.rarity === 'Common')
    const commonRanged = RANGED_WEAPONS.filter(w => w.rarity === 'Common')
    const pool = [...commonMelee, ...commonRanged]
    const w = pick(pool)
    weapon = { weaponName: w.name, condition: 'Used', ammoCurrent: w.clip ?? 0, ammoMax: w.clip ?? 0, reloads: w.ammo ? 1 : 0 }
  } else if (npcType === 'foe') {
    // Uncommon weapons
    const uncommonMelee = MELEE_WEAPONS.filter(w => w.rarity === 'Uncommon')
    const uncommonRanged = RANGED_WEAPONS.filter(w => w.rarity === 'Uncommon')
    const pool = [...uncommonMelee, ...uncommonRanged]
    const w = pick(pool)
    weapon = { weaponName: w.name, condition: 'Used', ammoCurrent: w.clip ?? 0, ammoMax: w.clip ?? 0, reloads: w.ammo ? 2 : 0 }
  } else if (npcType === 'antagonist') {
    // Uncommon or rare — favour ranged
    const goodRanged = RANGED_WEAPONS.filter(w => w.rarity === 'Uncommon' || w.rarity === 'Rare')
    const goodMelee = MELEE_WEAPONS.filter(w => w.rarity === 'Uncommon')
    const pool = [...goodRanged, ...goodRanged, ...goodMelee] // double weight ranged
    const w = pick(pool)
    weapon = { weaponName: w.name, condition: 'Used', ammoCurrent: w.clip ?? 0, ammoMax: w.clip ?? 0, reloads: w.ammo ? 3 : 0 }
  }
  // Friendly: no weapon assigned by default

  return {
    name, npc_type: npcType, gender,
    reason, acumen, physicality, influence, dexterity,
    skillEntries, notes, profession, motivation, complication, words, weapon,
  }
}
