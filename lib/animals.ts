// Bestiary — canonical animal stats from Distemper CRB v0.9.2
// p.194-195 (validated against the CRB on 2026-05-09).
//
// Six base animals + two H724-infected canine variants. Distemper
// variants share RAPID + secondary stats with their base species
// (the virus erodes the brain and cranks aggression but doesn't
// physically change them); they pick up extra skill levels in
// Athletics, Survival, and Unarmed Combat.
//
// CRB note (paraphrased): only canines carry H724 post-mutation;
// it's no longer terminal in all infected animals but invariably
// makes them hyper-aggressive. Smaller domesticated dogs didn't
// survive — what's left is the larger / wilder breed roaming
// nocturnal in 1d6 packs.
//
// Init / Enc — note that these are NOT derived (Init isn't ACU+DEX
// for animals; the CRB hand-tunes them). Stored as-given so the
// canonical numbers are what surface on the bestiary page and on
// any campaign_npc spawned from these templates.

export interface AnimalRapid {
  RSN: number
  ACU: number
  PHY: number
  INF: number
  DEX: number
}

export interface AnimalSkill {
  name: string
  level: number
  specialized: boolean
}

export interface AnimalSeed {
  name: string
  rapid: AnimalRapid
  /** Encoded RAPID string from the CRB (e.g. "01711" for Bear) —
   *  display helper, identical to expanding `rapid` digit-by-digit. */
  rapidCode: string
  wp_max: number
  rp_max: number
  /** Melee Defensive Modifier (MDM) — applied to attacker chance +
   *  damage on melee/unarmed attacks against this animal. */
  mdm: number
  /** Ranged Defensive Modifier (RDM) — same, for ranged attacks. */
  rdm: number
  init: number
  enc: number
  skills: AnimalSkill[]
  description: string
  /** True for Distemper-infected canines. Links to the base species
   *  via `baseAnimal` so the GM can compare side-by-side. */
  distemperInfected?: boolean
  baseAnimal?: string
}

export const ANIMALS: AnimalSeed[] = [
  {
    name: 'Bear',
    rapidCode: '01711',
    rapid: { RSN: 0, ACU: 1, PHY: 7, INF: 1, DEX: 1 },
    wp_max: 18, rp_max: 13, mdm: 7, rdm: 1, init: 3, enc: 13,
    skills: [
      { name: 'Athletics', level: 1, specialized: false },
      { name: 'Unarmed Combat', level: 5, specialized: false },
    ],
    description: 'A massive omnivore. Slow to start, devastating up close. Most dangerous when defending cubs or a kill.',
  },
  {
    name: 'Dog',
    rapidCode: '02203',
    rapid: { RSN: 0, ACU: 2, PHY: 2, INF: 0, DEX: 3 },
    wp_max: 15, rp_max: 8, mdm: 2, rdm: 3, init: 8, enc: 8,
    skills: [
      { name: 'Athletics', level: 2, specialized: false },
      { name: 'Unarmed Combat', level: 2, specialized: false },
    ],
    description: 'Domestic-breed canine, surviving year after the dog flu. Loyal companion or feral threat depending on circumstance.',
  },
  {
    name: 'Scavenger Bird',
    rapidCode: '01601',
    rapid: { RSN: 0, ACU: 1, PHY: 6, INF: 0, DEX: 1 },
    wp_max: 10, rp_max: 5, mdm: 1, rdm: 2, init: 6, enc: 4,
    skills: [
      { name: 'Athletics', level: 2, specialized: false },
      { name: 'Navigation', level: 1, specialized: false },
      { name: 'Survival', level: 2, specialized: false },
      { name: 'Unarmed Combat', level: 1, specialized: false },
    ],
    description: 'Crow, vulture, or similar. Mostly carrion-feeders. They mob in groups and follow the wounded for hours.',
  },
  {
    name: 'Horse',
    rapidCode: '01405',
    rapid: { RSN: 0, ACU: 1, PHY: 4, INF: 0, DEX: 5 },
    wp_max: 19, rp_max: 10, mdm: 4, rdm: 5, init: 7, enc: 10,
    skills: [
      { name: 'Athletics', level: 3, specialized: false },
      { name: 'Navigation', level: 2, specialized: false },
    ],
    description: 'Domesticated mount or feral. Surprisingly fast and dangerous when cornered or roused — can stomp, kick, bite.',
  },
  {
    name: 'Mountain Lion',
    rapidCode: '02305',
    rapid: { RSN: 0, ACU: 2, PHY: 3, INF: 0, DEX: 5 },
    wp_max: 18, rp_max: 9, mdm: 3, rdm: 5, init: 8, enc: 9,
    skills: [
      { name: 'Athletics', level: 3, specialized: false },
      { name: 'Unarmed Combat', level: 3, specialized: false },
    ],
    description: 'Apex predator. Prefers ambush from elevation. Once it commits to a charge it does not stop — fast, focused, and lethal.',
  },
  {
    name: 'Wolf',
    rapidCode: '02304',
    rapid: { RSN: 0, ACU: 2, PHY: 3, INF: 0, DEX: 4 },
    wp_max: 17, rp_max: 9, mdm: 3, rdm: 4, init: 7, enc: 9,
    skills: [
      { name: 'Athletics', level: 3, specialized: false },
      { name: 'Unarmed Combat', level: 3, specialized: false },
    ],
    description: 'Pack hunter. Coordinates with its kin to harry prey from multiple angles before closing.',
  },
  // Distemper-infected variants — same RAPID + secondary stats as the
  // base, plus extra skill levels reflecting heightened aggression.
  {
    name: 'Dog with Distemper',
    rapidCode: '02203',
    rapid: { RSN: 0, ACU: 2, PHY: 2, INF: 0, DEX: 3 },
    wp_max: 15, rp_max: 8, mdm: 2, rdm: 3, init: 8, enc: 8,
    skills: [
      { name: 'Athletics', level: 3, specialized: false },
      { name: 'Navigation', level: 2, specialized: false },
      { name: 'Survival', level: 1, specialized: false },
      { name: 'Unarmed Combat', level: 4, specialized: false },
    ],
    description: 'Larger / wilder canine that survived H724 infection. Brain partly eroded by the virus, hyper-aggressive, often nocturnal in packs of 1d6. Bites carry the virus — see Infection rules.',
    distemperInfected: true,
    baseAnimal: 'Dog',
  },
  {
    name: 'Wolf with Distemper',
    rapidCode: '02304',
    rapid: { RSN: 0, ACU: 2, PHY: 3, INF: 0, DEX: 4 },
    wp_max: 17, rp_max: 9, mdm: 3, rdm: 4, init: 7, enc: 9,
    skills: [
      { name: 'Athletics', level: 3, specialized: false },
      { name: 'Survival', level: 3, specialized: false },
      { name: 'Unarmed Combat', level: 4, specialized: false },
    ],
    description: 'A pack hunter with the dog flu — survival drive intact, fear circuits scrambled. Will press an attack past the point any healthy wolf would break off. Bites carry the virus.',
    distemperInfected: true,
    baseAnimal: 'Wolf',
  },
]
