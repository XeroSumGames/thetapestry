// ============================================================
// XERO SUM ENGINE SRD v1.1 — Character Schema & Static Data
// ============================================================

// ----------------------------
// ENUMS & CONSTANTS
// ----------------------------

export type AttributeName = 'RSN' | 'ACU' | 'PHY' | 'INF' | 'DEX';

export type AttributeValue = -2 | -1 | 0 | 1 | 2 | 3 | 4;
export type SkillValue = -3 | 0 | 1 | 2 | 3 | 4;
export type ItemCondition = 'Pristine' | 'Used' | 'Worn' | 'Damaged' | 'Broken';
export type WeaponSkill = 'Melee' | 'Unarmed' | 'Athletics' | 'Ranged' | 'Demolitions*';
export type WeaponRange = 'Engaged' | 'Close' | 'Medium' | 'Long' | 'Distant';
export type ItemRarity = 'Common' | 'Uncommon' | 'Rare';
export type ItemTrait =
  | 'Automatic Burst'
  | 'Blast Radius'
  | 'Burning'
  | 'Close-Up'
  | 'Cumbersome'
  | 'Stunned'
  | 'Tracking'
  | 'Unwieldy';
export type CreationMethod = 'backstory' | 'paradigm' | 'pregen';

// ----------------------------
// ATTRIBUTE MODIFIER TABLE
// ----------------------------

export const ATTRIBUTE_LABELS: Record<number, string> = {
  [-2]: 'Diminished',
  [-1]: 'Weak',
  0: 'Average',
  1: 'Good',
  2: 'Strong',
  3: 'Exceptional',
  4: 'Human Peak',
  5: 'Superhuman',
};

// ----------------------------
// SKILL MODIFIER TABLE
// ----------------------------

export const SKILL_LABELS: Record<number, string> = {
  [-3]: 'Inept',
  0: 'Untrained',
  1: 'Beginner',
  2: 'Journeyman',
  3: 'Professional',
  4: "Life's Work",
};

// ----------------------------
// OUTCOME TABLE
// ----------------------------

export const OUTCOMES = [
  { range: '0-3',  label: 'Dire Failure' },
  { range: '4-8',  label: 'Failure' },
  { range: '9-13', label: 'Success' },
  { range: '14+',  label: 'Wild Success' },
  { range: '1+1',  label: 'Moment of Low Insight' },
  { range: '6+6',  label: 'Moment of High Insight' },
] as const;

// ----------------------------
// SKILLS TABLE (Table 9)
// ----------------------------

export interface SkillDefinition {
  name: string;
  attribute: AttributeName;
  vocational: boolean;
  description: string;
}

export const SKILLS: SkillDefinition[] = [
  { name: 'Animal Handling',    attribute: 'INF', vocational: false, description: 'Understanding how to work with animals, from basic obedience to herd management' },
  { name: 'Athletics',          attribute: 'PHY', vocational: false, description: 'Fitness, agility, stamina, and coordination, including climbing, jumping, swimming, and overcoming obstacles' },
  { name: 'Barter',             attribute: 'INF', vocational: false, description: 'Arranging deals, enticing buyers, appraising goods, haggling for the best outcome, and closing deals' },
  { name: 'Demolitions*',       attribute: 'PHY', vocational: true,  description: 'The manufacture and use of explosives, ranging from improvised charges to precision military demolitions' },
  { name: 'Driving',            attribute: 'DEX', vocational: false, description: 'Drive any vehicle with confidence and finesse, this allows for reckless maneuvers without wrecking' },
  { name: 'Entertainment',      attribute: 'INF', vocational: false, description: 'The charisma and talent to captivate an audience through music, song, acting, comedy, storytelling, or other form of performance' },
  { name: 'Farming',            attribute: 'ACU', vocational: false, description: 'Knowing how to grow crops or raise livestock at scale to sustain large groups of people' },
  { name: 'Gambling',           attribute: 'ACU', vocational: false, description: 'The understanding of underlying mechanics behind games of chance, risk, and reward, and the confidence of knowing when to bet or fold' },
  { name: 'Heavy Weapons*',     attribute: 'PHY', vocational: true,  description: 'The operation of complex, large-scale battlefield weapons like machine guns, launchers, and artillery' },
  { name: 'Inspiration',        attribute: 'INF', vocational: false, description: 'Being able to boost the morale of individuals or groups or motivate them behind a shared vision or belief' },
  { name: 'Lock-Picking*',      attribute: 'ACU', vocational: true,  description: 'Bypassing locks and security devices to open them without keys or codes' },
  { name: 'Manipulation',       attribute: 'INF', vocational: false, description: 'Getting others to think, believe, or act in ways that they may not have otherwise done' },
  { name: 'Mechanic*',          attribute: 'RSN', vocational: true,  description: 'Diagnose, repair, maintain, or build complex machines, tools, vehicles, and systems' },
  { name: 'Medicine*',          attribute: 'RSN', vocational: true,  description: 'Providing first aid, diagnosis, treatment, emergency stabilization and advanced medical care to the injured or ill' },
  { name: 'Melee Combat',       attribute: 'PHY', vocational: false, description: 'Training with melee weapons to improve close-quarters precision, accuracy and damage' },
  { name: 'Navigation',         attribute: 'ACU', vocational: false, description: 'Innately able to discern directions, remember routes, and plot accurate courses' },
  { name: 'Psychology*',        attribute: 'RSN', vocational: true,  description: 'Leveraging an understanding of human behavior to influence, predict, exploit, or manipulate outcomes' },
  { name: 'Ranged Combat',      attribute: 'DEX', vocational: false, description: 'Accurately and safely using projectile weapons, ranging from thrown objects to sniper rifles' },
  { name: 'Research',           attribute: 'RSN', vocational: false, description: 'Being able to efficiently organize, distill, and absorb information to quickly become well informed on any subject' },
  { name: 'Scavenging',         attribute: 'ACU', vocational: false, description: 'Finding and evaluating missed, hidden, or discarded items that still have use for survival or trade' },
  { name: 'Sleight of Hand',    attribute: 'DEX', vocational: false, description: 'Well practiced in performing sleight-of-hand tricks, palming, pickpocketing, concealment, and creating subtle diversions' },
  { name: 'Specific Knowledge', attribute: 'RSN', vocational: false, description: 'Knowledge about the history, layout, and secrets of a specific area, community, person, or discipline' },
  { name: 'Stealth',            attribute: 'PHY', vocational: false, description: 'Avoid notice, moving unseen, sticking to the shadows, and avoiding detection' },
  { name: 'Streetwise',         attribute: 'ACU', vocational: false, description: 'Instinctively being able to navigate urban environments, read situations for danger, and identify underworld resources' },
  { name: 'Survival',           attribute: 'ACU', vocational: false, description: 'Knowing how to survive in the wild, live off the land, and track people or animals' },
  { name: 'Tactics*',           attribute: 'RSN', vocational: true,  description: 'The application of battlefield or interpersonal strategies in order to gain a situational advantage or upper hand' },
  { name: 'Tinkerer',           attribute: 'DEX', vocational: false, description: 'Being adept at fixing, modifying, or improving machines, gear, or weapons as well as the ability to improvise inventions' },
  { name: 'Unarmed Combat',     attribute: 'PHY', vocational: false, description: 'Knowledge and practice of grappling, fist fight, bare fists or martial arts, and body control' },
  { name: 'Weaponsmith*',       attribute: 'DEX', vocational: true,  description: 'Crafting, repairing, and modifying weapons to ensure reliability and effectiveness' },
];

// ----------------------------
// COMPLICATIONS TABLE (Table 6)
// ----------------------------

export const COMPLICATIONS: Record<number, string> = {
  2:  'Addiction',
  3:  'Betrayed',
  4:  'Code of Honor',
  5:  'Criminal Past',
  6:  'Daredevil',
  7:  'Dark Secret',
  8:  'Family Obligation',
  9:  'Famous',
  10: 'Loss',
  11: 'Outstanding Debt',
  12: 'Personal Enemy',
};

// ----------------------------
// MOTIVATIONS TABLE (Table 7)
// ----------------------------

export const MOTIVATIONS: Record<number, string> = {
  2:  'Accumulate',
  3:  'Build',
  4:  'Find Safety',
  5:  'Hedonism',
  6:  'Make Amends',
  7:  'Preach',
  8:  'Protect',
  9:  'Reunite',
  10: 'Revenge',
  11: 'Stay Alive',
  12: 'Take Advantage',
};

// ----------------------------
// PROFESSIONS TABLE (Table 8)
// ----------------------------

export interface ProfessionDefinition {
  name: string;
  skills: string[];
}

export const PROFESSIONS: ProfessionDefinition[] = [
  { name: 'Academic',        skills: ['Mechanic*', 'Psychology*', 'Research', 'Specific Knowledge', 'Tactics*'] },
  { name: 'Driver',          skills: ['Animal Handling', 'Driving', 'Lock-Picking*', 'Mechanic*', 'Navigation'] },
  { name: 'Entrepreneur',    skills: ['Barter', 'Gambling', 'Inspiration', 'Manipulation', 'Research'] },
  { name: 'Law Enforcement', skills: ['Athletics', 'Ranged Combat', 'Streetwise', 'Survival', 'Tactics*'] },
  { name: 'Mechanic',        skills: ['Barter', 'Demolitions*', 'Mechanic*', 'Scavenging', 'Tinkerer'] },
  { name: 'Medic',           skills: ['Manipulation', 'Medicine*', 'Psychology*', 'Research', 'Sleight of Hand'] },
  { name: 'Military',        skills: ['Demolitions*', 'Heavy Weapons*', 'Ranged Combat', 'Tactics*', 'Unarmed Combat'] },
  { name: 'Outdoorsman',     skills: ['Animal Handling', 'Navigation', 'Ranged Combat', 'Stealth', 'Survival'] },
  { name: 'Outlaw',          skills: ['Gambling', 'Lock-Picking*', 'Sleight of Hand', 'Stealth', 'Streetwise'] },
  { name: 'Performer',       skills: ['Athletics', 'Entertainment', 'Inspiration', 'Manipulation', 'Specific Knowledge'] },
  { name: 'Politician',      skills: ['Inspiration', 'Manipulation', 'Psychology*', 'Streetwise', 'Tactics*'] },
  { name: 'Trader',          skills: ['Barter', 'Scavenging', 'Sleight of Hand', 'Specific Knowledge', 'Tinkerer'] },
];

// ----------------------------
// WEAPON TRAIT DEFINITION
// ----------------------------

export interface WeaponTrait {
  name: ItemTrait;
  value?: number;
}

// ----------------------------
// MELEE WEAPONS (Table 16)
// ----------------------------

export interface MeleeWeapon {
  name: string;
  skill: 'Melee' | 'Unarmed' | 'Athletics';
  range: 'Engaged' | 'Close';
  rarity: ItemRarity;
  damageBase: number;
  damageDice: string;
  rpPercent: number;
  enc: number;
  traits: WeaponTrait[];
}

export const MELEE_WEAPONS: MeleeWeapon[] = [
  { name: 'Baseball Bat',    skill: 'Melee',    range: 'Engaged', rarity: 'Common',   damageBase: 4, damageDice: '1d6', rpPercent: 100, enc: 1, traits: [] },
  { name: 'Brass Knuckles',  skill: 'Unarmed',  range: 'Engaged', rarity: 'Uncommon', damageBase: 1, damageDice: '',    rpPercent: 100, enc: 0, traits: [] },
  { name: 'Bullwhip',        skill: 'Athletics',range: 'Close',   rarity: 'Uncommon', damageBase: 1, damageDice: '1d3', rpPercent: 100, enc: 1, traits: [{ name: 'Unwieldy', value: 2 }] },
  { name: 'Club',            skill: 'Melee',    range: 'Engaged', rarity: 'Common',   damageBase: 5, damageDice: '1d6', rpPercent: 100, enc: 2, traits: [{ name: 'Cumbersome', value: 1 }] },
  { name: 'Fire Axe',        skill: 'Melee',    range: 'Close',   rarity: 'Uncommon', damageBase: 3, damageDice: '2d3', rpPercent:  50, enc: 1, traits: [] },
  { name: 'Hatchet',         skill: 'Melee',    range: 'Engaged', rarity: 'Common',   damageBase: 3, damageDice: '1d3', rpPercent:  50, enc: 1, traits: [] },
  { name: 'Hunting Knife',   skill: 'Melee',    range: 'Engaged', rarity: 'Common',   damageBase: 2, damageDice: '2d3', rpPercent:  50, enc: 1, traits: [{ name: 'Unwieldy', value: 1 }] },
  { name: 'Kitchen Knife',   skill: 'Melee',    range: 'Engaged', rarity: 'Common',   damageBase: 2, damageDice: '1d3', rpPercent:  50, enc: 1, traits: [] },
  { name: 'Machete',         skill: 'Melee',    range: 'Close',   rarity: 'Uncommon', damageBase: 3, damageDice: '2d3', rpPercent:  50, enc: 1, traits: [{ name: 'Unwieldy', value: 2 }] },
  { name: 'Makeshift Club',  skill: 'Melee',    range: 'Engaged', rarity: 'Common',   damageBase: 3, damageDice: '1d3', rpPercent: 100, enc: 1, traits: [] },
  { name: 'Sledgehammer',    skill: 'Melee',    range: 'Engaged', rarity: 'Uncommon', damageBase: 3, damageDice: '3d3', rpPercent: 100, enc: 2, traits: [{ name: 'Cumbersome', value: 2 }] },
  { name: 'Spear',           skill: 'Melee',    range: 'Close',   rarity: 'Uncommon', damageBase: 2, damageDice: '2d6', rpPercent:  50, enc: 1, traits: [{ name: 'Cumbersome', value: 2 }] },
  { name: 'Staff',           skill: 'Melee',    range: 'Close',   rarity: 'Common',   damageBase: 2, damageDice: '2d3', rpPercent: 100, enc: 1, traits: [{ name: 'Unwieldy', value: 1 }] },
  { name: 'Sword',           skill: 'Melee',    range: 'Engaged', rarity: 'Uncommon', damageBase: 3, damageDice: '3d3', rpPercent:  50, enc: 1, traits: [] },
  { name: 'Tactical Baton',  skill: 'Melee',    range: 'Engaged', rarity: 'Uncommon', damageBase: 4, damageDice: '2d3', rpPercent: 100, enc: 1, traits: [] },
  { name: 'Taser',           skill: 'Melee',    range: 'Engaged', rarity: 'Uncommon', damageBase: 2, damageDice: '',    rpPercent: 400, enc: 1, traits: [{ name: 'Stunned' }] },
  { name: 'Wood Axe',        skill: 'Melee',    range: 'Close',   rarity: 'Uncommon', damageBase: 5, damageDice: '1d3', rpPercent:  50, enc: 1, traits: [{ name: 'Cumbersome', value: 1 }] },
];

// ----------------------------
// RANGED WEAPONS (Table 17)
// ----------------------------

export interface RangedWeapon {
  name: string;
  skill: 'Ranged';
  range: WeaponRange;
  rarity: ItemRarity;
  damageBase: number;
  damageDice: string;
  rpPercent: number;
  enc: number;
  ammoRarity: ItemRarity;
  clipSize: number;
  traits: WeaponTrait[];
}

export const RANGED_WEAPONS: RangedWeapon[] = [
  { name: 'Automatic Rifle',      skill: 'Ranged', range: 'Long',    rarity: 'Uncommon', damageBase: 5, damageDice: '2d6', rpPercent: 50, enc: 2, ammoRarity: 'Uncommon', clipSize: 30, traits: [{ name: 'Automatic Burst', value: 3 }] },
  { name: 'Black Powder Rifle',   skill: 'Ranged', range: 'Long',    rarity: 'Uncommon', damageBase: 5, damageDice: '1d6', rpPercent: 50, enc: 2, ammoRarity: 'Uncommon', clipSize:  1, traits: [] },
  { name: 'Bow',                  skill: 'Ranged', range: 'Medium',  rarity: 'Common',   damageBase: 4, damageDice: '1d6', rpPercent: 50, enc: 1, ammoRarity: 'Common',   clipSize:  1, traits: [{ name: 'Tracking' }] },
  { name: 'Carbine',              skill: 'Ranged', range: 'Medium',  rarity: 'Uncommon', damageBase: 5, damageDice: '1d6', rpPercent: 50, enc: 1, ammoRarity: 'Uncommon', clipSize: 30, traits: [{ name: 'Automatic Burst' }] },
  { name: 'Compound Bow',         skill: 'Ranged', range: 'Long',    rarity: 'Common',   damageBase: 4, damageDice: '2d3', rpPercent: 50, enc: 2, ammoRarity: 'Common',   clipSize:  1, traits: [{ name: 'Tracking' }] },
  { name: 'Crossbow',             skill: 'Ranged', range: 'Medium',  rarity: 'Uncommon', damageBase: 4, damageDice: '1d6', rpPercent: 50, enc: 2, ammoRarity: 'Uncommon', clipSize:  1, traits: [{ name: 'Unwieldy', value: 1 }] },
  { name: 'Heavy Pistol',         skill: 'Ranged', range: 'Close',   rarity: 'Common',   damageBase: 3, damageDice: '2d3', rpPercent: 50, enc: 1, ammoRarity: 'Uncommon', clipSize:  9, traits: [] },
  { name: 'Hunting Rifle',        skill: 'Ranged', range: 'Long',    rarity: 'Common',   damageBase: 5, damageDice: '1d6', rpPercent: 50, enc: 2, ammoRarity: 'Uncommon', clipSize: 12, traits: [] },
  { name: 'Light Pistol',         skill: 'Ranged', range: 'Close',   rarity: 'Common',   damageBase: 3, damageDice: '1d6', rpPercent: 50, enc: 1, ammoRarity: 'Common',   clipSize:  6, traits: [] },
  { name: 'Shotgun (Pump-Action)',skill: 'Ranged', range: 'Medium',  rarity: 'Common',   damageBase: 5, damageDice: '2d6', rpPercent: 50, enc: 2, ammoRarity: 'Common',   clipSize:  5, traits: [{ name: 'Close-Up' }] },
  { name: 'Shotgun (Sawed-Off)',  skill: 'Ranged', range: 'Close',   rarity: 'Uncommon', damageBase: 2, damageDice: '3d6', rpPercent: 50, enc: 2, ammoRarity: 'Common',   clipSize:  2, traits: [{ name: 'Close-Up' }] },
  { name: 'Slingshot',            skill: 'Ranged', range: 'Close',   rarity: 'Common',   damageBase: 1, damageDice: '1d3', rpPercent:100, enc: 0, ammoRarity: 'Common',   clipSize:  1, traits: [{ name: 'Tracking' }] },
  { name: "Sniper's Rifle",       skill: 'Ranged', range: 'Distant', rarity: 'Rare',     damageBase: 2, damageDice: '3d6', rpPercent: 50, enc: 2, ammoRarity: 'Uncommon', clipSize: 10, traits: [] },
];

// ----------------------------
// EQUIPMENT (Table 20)
// ----------------------------

export interface EquipmentItem {
  name: string;
  rarity: ItemRarity;
  enc: number;
  notes: string;
}

export const EQUIPMENT: EquipmentItem[] = [
  { name: "Angler's Set",           rarity: 'Uncommon', enc: 1, notes: '+2 to Fishing attempts' },
  { name: 'Backpack',               rarity: 'Common',   enc: 0, notes: '+2 Encumbrance' },
  { name: 'Basic Survival Kit',     rarity: 'Common',   enc: 2, notes: 'Tent, Sleeping Bag' },
  { name: 'Bicycle Repair Kit',     rarity: 'Common',   enc: 0, notes: '' },
  { name: 'Bolt Cutters',           rarity: 'Common',   enc: 1, notes: '' },
  { name: 'Binoculars',             rarity: 'Common',   enc: 1, notes: '+1 Perception Check when at Long or Distant Range' },
  { name: 'Canteen',                rarity: 'Common',   enc: 0, notes: '' },
  { name: 'Climbing Gear',          rarity: 'Uncommon', enc: 1, notes: 'Includes ropes, carabiners, and harnesses. Can be used to scaling buildings.' },
  { name: 'Compass',                rarity: 'Common',   enc: 0, notes: '+1 Navigation Checks' },
  { name: 'Crowbar',                rarity: 'Common',   enc: 1, notes: '' },
  { name: "Doctor's Bag",           rarity: 'Uncommon', enc: 1, notes: '+2 to any Medicine* check; heals 1+2d3 over a 24 hour period' },
  { name: 'Fire-starting Kit',      rarity: 'Common',   enc: 0, notes: '' },
  { name: 'First Aid Kit',          rarity: 'Common',   enc: 1, notes: '+1 to any Medicine* check; heals 1+1d3 over a 24 hour period' },
  { name: 'Fishing Kit',            rarity: 'Common',   enc: 1, notes: '+1 to Fishing attempts' },
  { name: 'Flashbang',              rarity: 'Uncommon', enc: 1, notes: 'Characters at Close must make a Physicality check or be Stunned(3)' },
  { name: 'Flashlight',             rarity: 'Uncommon', enc: 1, notes: '' },
  { name: 'Grappling Hook',         rarity: 'Uncommon', enc: 1, notes: '+1 to Athletics checks when climbing' },
  { name: 'Handcuffs',              rarity: 'Uncommon', enc: 1, notes: '' },
  { name: 'Instant Camera',         rarity: 'Uncommon', enc: 1, notes: '6 Charges, +1 Manipulation when used on people in pictures' },
  { name: 'Lantern',                rarity: 'Common',   enc: 1, notes: '' },
  { name: 'Military Backpack',      rarity: 'Uncommon', enc: 0, notes: '+2 Encumbrance' },
  { name: 'Multitool',              rarity: 'Common',   enc: 1, notes: '+1 Tinkering or Mechanic* check' },
  { name: 'Night Vision Goggles',   rarity: 'Uncommon', enc: 1, notes: 'Allows the wearer to see clearly at night' },
  { name: 'Radio Scanner',          rarity: 'Common',   enc: 1, notes: '' },
  { name: 'Rope',                   rarity: 'Common',   enc: 1, notes: '' },
  { name: 'Shovel',                 rarity: 'Common',   enc: 1, notes: '' },
  { name: 'Survivalists Kit',       rarity: 'Uncommon', enc: 2, notes: 'Waterproof Tent, Sleeping Bag, Fire-starting Kit, 3 days of rations' },
  { name: 'Standard Lockpicks',     rarity: 'Uncommon', enc: 0, notes: '+1 to Lock-Picking checks' },
  { name: 'Criminal Lockpicks',     rarity: 'Rare',     enc: 0, notes: '+3 to Lock-Picking checks' },
  { name: 'Hunting Traps',          rarity: 'Common',   enc: 1, notes: '' },
  { name: 'Toolkit',                rarity: 'Common',   enc: 1, notes: '+1 Mechanics* check' },
  { name: 'Walkie-Talkies',         rarity: 'Uncommon', enc: 1, notes: 'Range of 20 miles' },
  { name: 'Weapons Toolkit',        rarity: 'Uncommon', enc: 1, notes: 'Required for Weapons maintenance and repairs' },
  { name: "Workman's Toolkit",      rarity: 'Uncommon', enc: 1, notes: '+2 Mechanics* check' },
];

// ----------------------------
// PARADIGMS (Appendix D)
// ----------------------------

export interface ParadigmSkillEntry {
  skillName: string;
  level: SkillValue;
}

export interface Paradigm {
  name: string;
  profession: string;
  rapid: Record<AttributeName, AttributeValue>;
  skills: ParadigmSkillEntry[];
}

export const PARADIGMS: Paradigm[] = [
  {
    name: 'School Teacher', profession: 'Academic',
    rapid: { RSN: 3, ACU: 1, PHY: 0, INF: 1, DEX: 0 },
    skills: [
      { skillName: 'Entertainment',   level: 2 },
      { skillName: 'Inspiration',     level: 2 },
      { skillName: 'Medicine*',       level: 2 },
      { skillName: 'Research',        level: 2 },
      { skillName: 'Athletics',       level: 1 },
      { skillName: 'Barter',          level: 1 },
      { skillName: 'Manipulation',    level: 1 },
      { skillName: 'Psychology*',     level: 1 },
      { skillName: 'Specific Knowledge', level: 1 },
      { skillName: 'Stealth',         level: 1 },
      { skillName: 'Tinkerer',        level: 1 },
    ],
  },
  {
    name: 'Biker', profession: 'Driver',
    rapid: { RSN: 0, ACU: 2, PHY: 1, INF: 0, DEX: 2 },
    skills: [
      { skillName: 'Driving',         level: 2 },
      { skillName: 'Barter',          level: 1 },
      { skillName: 'Demolitions*',    level: 1 },
      { skillName: 'Lock-Picking*',   level: 1 },
      { skillName: 'Manipulation',    level: 1 },
      { skillName: 'Mechanic*',       level: 1 },
      { skillName: 'Melee Combat',    level: 1 },
      { skillName: 'Navigation',      level: 1 },
      { skillName: 'Scavenging',      level: 1 },
      { skillName: 'Stealth',         level: 1 },
      { skillName: 'Survival',        level: 1 },
      { skillName: 'Tactics*',        level: 1 },
      { skillName: 'Tinkerer',        level: 1 },
      { skillName: 'Unarmed Combat',  level: 1 },
    ],
  },
  {
    name: 'Bar Owner', profession: 'Entrepreneur',
    rapid: { RSN: 1, ACU: 2, PHY: 1, INF: 1, DEX: 0 },
    skills: [
      { skillName: 'Barter',          level: 2 },
      { skillName: 'Manipulation',    level: 2 },
      { skillName: 'Athletics',       level: 1 },
      { skillName: 'Entertainment',   level: 1 },
      { skillName: 'Gambling',        level: 1 },
      { skillName: 'Inspiration',     level: 1 },
      { skillName: 'Medicine*',       level: 1 },
      { skillName: 'Psychology*',     level: 1 },
      { skillName: 'Scavenging',      level: 1 },
      { skillName: 'Sleight of Hand', level: 1 },
      { skillName: 'Specific Knowledge', level: 1 },
      { skillName: 'Tinkerer',        level: 1 },
      { skillName: 'Unarmed Combat',  level: 1 },
    ],
  },
  {
    name: 'Rural Sheriff', profession: 'Law Enforcement',
    rapid: { RSN: 0, ACU: 2, PHY: 0, INF: 2, DEX: 1 },
    skills: [
      { skillName: 'Tactics*',        level: 2 },
      { skillName: 'Manipulation',    level: 2 },
      { skillName: 'Animal Handling', level: 1 },
      { skillName: 'Barter',          level: 1 },
      { skillName: 'Inspiration',     level: 1 },
      { skillName: 'Lock-Picking*',   level: 1 },
      { skillName: 'Navigation',      level: 1 },
      { skillName: 'Psychology*',     level: 1 },
      { skillName: 'Ranged Combat',   level: 1 },
      { skillName: 'Scavenging',      level: 1 },
      { skillName: 'Sleight of Hand', level: 1 },
      { skillName: 'Stealth',         level: 1 },
      { skillName: 'Unarmed Combat',  level: 1 },
    ],
  },
  {
    name: 'Hot Rod Mechanic', profession: 'Mechanic',
    rapid: { RSN: 1, ACU: 1, PHY: 1, INF: 0, DEX: 2 },
    skills: [
      { skillName: 'Mechanic*',       level: 3 },
      { skillName: 'Barter',          level: 2 },
      { skillName: 'Demolitions*',    level: 2 },
      { skillName: 'Driving',         level: 1 },
      { skillName: 'Lock-Picking*',   level: 1 },
      { skillName: 'Melee Combat',    level: 1 },
      { skillName: 'Navigation',      level: 1 },
      { skillName: 'Scavenging',      level: 1 },
      { skillName: 'Specific Knowledge', level: 1 },
      { skillName: 'Tinkerer',        level: 2 },
    ],
  },
  {
    name: 'EMT', profession: 'Medic',
    rapid: { RSN: 2, ACU: 1, PHY: 0, INF: 1, DEX: 1 },
    skills: [
      { skillName: 'Athletics',       level: 2 },
      { skillName: 'Medicine*',       level: 2 },
      { skillName: 'Psychology*',     level: 2 },
      { skillName: 'Driving',         level: 1 },
      { skillName: 'Inspiration',     level: 1 },
      { skillName: 'Manipulation',    level: 1 },
      { skillName: 'Navigation',      level: 1 },
      { skillName: 'Research',        level: 1 },
      { skillName: 'Scavenging',      level: 1 },
      { skillName: 'Sleight of Hand', level: 1 },
      { skillName: 'Specific Knowledge', level: 1 },
      { skillName: 'Streetwise',      level: 1 },
    ],
  },
  {
    name: 'Farmer', profession: 'Outdoorsman',
    rapid: { RSN: 0, ACU: 2, PHY: 2, INF: 0, DEX: 1 },
    skills: [
      { skillName: 'Farming',         level: 3 },
      { skillName: 'Scavenging',      level: 2 },
      { skillName: 'Stealth',         level: 2 },
      { skillName: 'Survival',        level: 2 },
      { skillName: 'Animal Handling', level: 1 },
      { skillName: 'Athletics',       level: 1 },
      { skillName: 'Navigation',      level: 1 },
      { skillName: 'Ranged Combat',   level: 1 },
      { skillName: 'Tinkerer',        level: 1 },
    ],
  },
  {
    name: 'Petty Criminal', profession: 'Outlaw',
    rapid: { RSN: 0, ACU: 1, PHY: 1, INF: 1, DEX: 2 },
    skills: [
      { skillName: 'Lock-Picking*',   level: 2 },
      { skillName: 'Manipulation',    level: 2 },
      { skillName: 'Scavenging',      level: 2 },
      { skillName: 'Sleight of Hand', level: 2 },
      { skillName: 'Streetwise',      level: 2 },
      { skillName: 'Barter',          level: 1 },
      { skillName: 'Melee Combat',    level: 1 },
      { skillName: 'Stealth',         level: 1 },
      { skillName: 'Survival',        level: 1 },
      { skillName: 'Unarmed Combat',  level: 1 },
    ],
  },
  {
    name: 'Mercenary', profession: 'Military',
    rapid: { RSN: 0, ACU: 1, PHY: 2, INF: 0, DEX: 2 },
    skills: [
      { skillName: 'Survival',        level: 3 },
      { skillName: 'Stealth',         level: 2 },
      { skillName: 'Tactics*',        level: 2 },
      { skillName: 'Athletics',       level: 1 },
      { skillName: 'Demolitions*',    level: 1 },
      { skillName: 'Heavy Weapons*',  level: 1 },
      { skillName: 'Melee Combat',    level: 1 },
      { skillName: 'Ranged Combat',   level: 1 },
      { skillName: 'Tinkerer',        level: 1 },
      { skillName: 'Unarmed Combat',  level: 1 },
      { skillName: 'Weaponsmith*',    level: 1 },
    ],
  },
  {
    name: 'Preacher', profession: 'Performer',
    rapid: { RSN: 1, ACU: 1, PHY: 0, INF: 3, DEX: 0 },
    skills: [
      { skillName: 'Inspiration',     level: 3 },
      { skillName: 'Barter',          level: 2 },
      { skillName: 'Manipulation',    level: 2 },
      { skillName: 'Psychology*',     level: 2 },
      { skillName: 'Entertainment',   level: 1 },
      { skillName: 'Ranged Combat',   level: 1 },
      { skillName: 'Research',        level: 1 },
      { skillName: 'Specific Knowledge', level: 1 },
      { skillName: 'Stealth',         level: 1 },
      { skillName: 'Tactics*',        level: 1 },
    ],
  },
  {
    name: 'Small Town Mayor', profession: 'Politician',
    rapid: { RSN: 2, ACU: 1, PHY: 0, INF: 2, DEX: 0 },
    skills: [
      { skillName: 'Inspiration',     level: 3 },
      { skillName: 'Manipulation',    level: 3 },
      { skillName: 'Psychology*',     level: 2 },
      { skillName: 'Streetwise',      level: 2 },
      { skillName: 'Tactics*',        level: 2 },
      { skillName: 'Barter',          level: 1 },
      { skillName: 'Entertainment',   level: 1 },
      { skillName: 'Research',        level: 1 },
    ],
  },
  {
    name: 'Flea Market Trader', profession: 'Trader',
    rapid: { RSN: 1, ACU: 2, PHY: 0, INF: 2, DEX: 0 },
    skills: [
      { skillName: 'Barter',          level: 3 },
      { skillName: 'Manipulation',    level: 2 },
      { skillName: 'Entertainment',   level: 1 },
      { skillName: 'Tinkerer',        level: 2 },
      { skillName: 'Psychology*',     level: 1 },
      { skillName: 'Research',        level: 1 },
      { skillName: 'Scavenging',      level: 1 },
      { skillName: 'Sleight of Hand', level: 1 },
      { skillName: 'Specific Knowledge', level: 1 },
      { skillName: 'Stealth',         level: 1 },
      { skillName: 'Survival',        level: 1 },
    ],
  },
];

// ----------------------------
// LASTING WOUNDS (Table 12)
// ----------------------------

export const LASTING_WOUNDS: Record<number, { name: string; effect: string }> = {
  2:  { name: 'Lost Eye',     effect: '-1 on checks using Dexterity' },
  3:  { name: 'Brain Injury', effect: '-2 Reason' },
  4:  { name: 'Diminished',   effect: '-1 Dexterity' },
  5:  { name: 'Shaken',       effect: '-1 Max. Resilience Points' },
  6:  { name: 'Weakened',     effect: '-1 Max. Wound Points' },
  7:  { name: 'Skittish',     effect: '-1 Initiative Modifier' },
  8:  { name: 'Scarring',     effect: '-1 Influence' },
  9:  { name: 'Fragile',      effect: '-1 Physicality' },
  10: { name: 'Hearing Loss', effect: '-1 Acumen' },
  11: { name: 'Crippled',     effect: '-1 Perception & -1 Acumen' },
  12: { name: 'Shell Shock',  effect: '-2 Dexterity' },
};

// ----------------------------
// BREAKING POINT (Table 13)
// ----------------------------

export const BREAKING_POINT: Record<number, { name: string; effect: string }> = {
  2:  { name: 'Catatonia',              effect: '-1 on Dexterity checks' },
  3:  { name: 'Compulsive Fixation',    effect: '-2 Reason' },
  4:  { name: 'Blind Rage',             effect: '-1 Dexterity' },
  5:  { name: 'Dissociation',           effect: '-1 Maximum RP' },
  6:  { name: 'Overwhelm',              effect: '-1 Max. Wound Points' },
  7:  { name: 'Panic Surge',            effect: '-1 Initiative Modifier' },
  8:  { name: 'Fatalism',               effect: '-1 Influence' },
  9:  { name: 'Reckless Abandon',       effect: '-1 Physicality' },
  10: { name: 'Self-Harm',              effect: '-1 Acumen' },
  11: { name: 'Self-Destructive Urges', effect: '-1 Per -1 Acu' },
  12: { name: 'Irrational Outburst',    effect: '-2 Dexterity' },
};

// ----------------------------
// BACKSTORY CREATION STEPS
// ----------------------------

export interface BackstoryStep {
  id: string;
  title: string;
  description: string;
  attributeCDP: number;
  skillCDP: number;
  maxAttributeLevel: AttributeValue;
  maxSkillLevel: SkillValue;
}

export const BACKSTORY_STEPS: BackstoryStep[] = [
  { id: 'step0', title: 'Step Zero: Who Are They?', description: 'Define name, age, height, weight, and pick 3 thematic words.', attributeCDP: 0, skillCDP: 0, maxAttributeLevel: 0, maxSkillLevel: 0 },
  { id: 'step1', title: 'Step One: Where They Grew Up', description: 'The first 10-15 years. Raise 1 attribute from 0 to 1. Spend 2 CDP on skills (max Journeyman).', attributeCDP: 1, skillCDP: 2, maxAttributeLevel: 1, maxSkillLevel: 2 },
  { id: 'step2', title: 'Step Two: What They Learned', description: 'The educational stage. Raise 1 attribute. Spend 3 CDP on skills (max Journeyman).', attributeCDP: 1, skillCDP: 3, maxAttributeLevel: 1, maxSkillLevel: 2 },
  { id: 'step3', title: 'Step Three: What They Like To Do', description: 'Hobbies and spare time. Raise 1 attribute. Spend 3 CDP on skills (max Journeyman).', attributeCDP: 1, skillCDP: 3, maxAttributeLevel: 1, maxSkillLevel: 2 },
  { id: 'step4', title: 'Step Four: How They Make Money', description: 'Career and vocation. Raise up to 2 attributes (max Exceptional). Spend 4 CDP on skills (max Professional). Choose a Profession.', attributeCDP: 2, skillCDP: 4, maxAttributeLevel: 3, maxSkillLevel: 3 },
  { id: 'step5', title: 'Step Five: What Makes Them Them', description: 'Final polish. Spend 3 CDP on skills (max Professional). No attributes this step.', attributeCDP: 0, skillCDP: 3, maxAttributeLevel: 3, maxSkillLevel: 3 },
  { id: 'step6', title: 'Step Six: What Drives Them?', description: 'Choose or roll Complication and Motivation.', attributeCDP: 0, skillCDP: 0, maxAttributeLevel: 3, maxSkillLevel: 3 },
];

// ----------------------------
// CHARACTER RECORD (the output)
// ----------------------------

export interface CharacterWeapon {
  weaponName: string;
  condition: ItemCondition;
  ammoCurrent: number;
}

export interface CharacterSkill {
  skillName: string;
  level: SkillValue;
}

export interface SecondaryStats {
  woundPoints: number;
  resiliencePoints: number;
  rangedDefense: number;
  meleeDefense: number;
  initiative: number;
  encumbrance: number;
  perception: number;
  stressModifier: number;
  morality: number;
}

export interface XSECharacter {
  // Identity
  name: string;
  age: string;
  gender: string;
  profession: string;
  height: string;
  weight: string;
  physdesc: string;
  photoDataUrl: string;
  threeWords: [string, string, string];
  complication: string;
  motivation: string;
  notes: string;

  // Creation
  creationMethod: CreationMethod;
  paradigmName?: string;

  // Attributes
  rapid: Record<AttributeName, AttributeValue>;

  // Derived
  secondary: SecondaryStats;

  // Skills
  skills: CharacterSkill[];

  // Weapons
  weaponPrimary: CharacterWeapon;
  weaponSecondary: CharacterWeapon;

  // Equipment
  equipment: string[];
  incidentalItem: string;
  rations: string;

  // Tracking
  insightDice: number;
  cdp: number;
  stressLevel: number;
  breakingPoint: number;
  lastingWounds: string[];

  // Relationships
  relationships: Array<{ npc: string; cmod: number }>;
}

// ----------------------------
// DERIVED STAT CALCULATOR
// ----------------------------

export function deriveSecondaryStats(
  rapid: Record<AttributeName, AttributeValue>
): SecondaryStats {
  return {
    woundPoints:      10 + rapid.PHY + rapid.DEX,
    resiliencePoints:  6 + rapid.PHY,
    rangedDefense:       rapid.DEX,
    meleeDefense:        rapid.PHY,
    initiative:          rapid.DEX + rapid.ACU,
    encumbrance:       6 + rapid.PHY,
    perception:          rapid.RSN + rapid.ACU,
    stressModifier:      rapid.RSN + rapid.ACU,
    morality:            3,
  };
}

// ----------------------------
// BLANK CHARACTER FACTORY
// ----------------------------

export function createBlankCharacter(): XSECharacter {
  const rapid: Record<AttributeName, AttributeValue> = {
    RSN: 0, ACU: 0, PHY: 0, INF: 0, DEX: 0,
  };
  return {
    name: '',
    age: '',
    gender: '',
    profession: '',
    height: '',
    weight: '',
    physdesc: '',
    photoDataUrl: '',
    threeWords: ['', '', ''],
    complication: '',
    motivation: '',
    notes: '',
    creationMethod: 'backstory',
    rapid,
    secondary: deriveSecondaryStats(rapid),
    skills: SKILLS.map(s => ({
      skillName: s.name,
      level: (s.vocational ? -3 : 0) as SkillValue,
    })),
    weaponPrimary:   { weaponName: '', condition: 'Used', ammoCurrent: 0 },
    weaponSecondary: { weaponName: '', condition: 'Used', ammoCurrent: 0 },
    equipment: [],
    incidentalItem: '',
    rations: '',
    insightDice: 2,
    cdp: 0,
    stressLevel: 0,
    breakingPoint: 0,
    lastingWounds: [],
    relationships: [],
  };
}

// ----------------------------
// PREGEN CHARACTER BUILDER
// ----------------------------

export function buildCharacterFromPregen(seed: {
  name: string; profession: string; age: number; gender: string;
  height: string; weight: string;
  three_words: string; complication: string; motivation: string;
  reason: number; acumen: number; physicality: number;
  influence: number; dexterity: number;
  skills: { skillName: string; level: number }[];
  weaponPrimary: { weaponName: string; condition: string; ammoCurrent: number };
  weaponSecondary?: { weaponName: string; condition: string; ammoCurrent: number };
  equipment: string[];
  incidentalItem?: string;
  breakingPoint: number;
  description: string;
  relationships: { npc: string; cmod: number }[];
}): XSECharacter {
  const rapid: Record<AttributeName, AttributeValue> = {
    RSN: seed.reason   as AttributeValue,
    ACU: seed.acumen   as AttributeValue,
    PHY: seed.physicality as AttributeValue,
    INF: seed.influence as AttributeValue,
    DEX: seed.dexterity as AttributeValue,
  };
  const secondary = deriveSecondaryStats(rapid);
  const words = seed.three_words.split(',').map(w => w.trim());

  // Build skill levels from seed — start with canonical defaults, then overlay
  const skillMap = new Map(seed.skills.map(s => [s.skillName, s.level]));
  const skills: CharacterSkill[] = SKILLS.map(s => ({
    skillName: s.name,
    level: (skillMap.get(s.name) ?? (s.vocational ? -3 : 0)) as SkillValue,
  }));

  return {
    name: seed.name,
    age: String(seed.age),
    gender: seed.gender,
    profession: seed.profession,
    height: seed.height,
    weight: seed.weight,
    physdesc: '',
    photoDataUrl: '',
    threeWords: [words[0] ?? '', words[1] ?? '', words[2] ?? ''] as [string, string, string],
    complication: seed.complication,
    motivation: seed.motivation,
    notes: seed.description,
    creationMethod: 'pregen',
    rapid,
    secondary: { ...secondary, morality: 3 },
    skills,
    weaponPrimary: {
      weaponName: seed.weaponPrimary.weaponName,
      condition: seed.weaponPrimary.condition as ItemCondition,
      ammoCurrent: seed.weaponPrimary.ammoCurrent,
    },
    weaponSecondary: seed.weaponSecondary
      ? { weaponName: seed.weaponSecondary.weaponName, condition: seed.weaponSecondary.condition as ItemCondition, ammoCurrent: seed.weaponSecondary.ammoCurrent }
      : { weaponName: '', condition: 'Used', ammoCurrent: 0 },
    equipment: seed.equipment,
    incidentalItem: seed.incidentalItem ?? '',
    rations: '',
    insightDice: 2,
    cdp: 0,
    stressLevel: 0,
    breakingPoint: seed.breakingPoint,
    lastingWounds: [],
    relationships: seed.relationships,
  };
}
