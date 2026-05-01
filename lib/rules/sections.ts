// Rules sitemap. Drives the left-rail nav (RulesNav) and the landing page.
// Order matches XSE SRD v1.1.17 table of contents.

export interface RuleAnchor {
  /** Anchor id (matches the H2/H3 `id="…"` attribute on the page) */
  id: string
  /** Label shown in the sticky nav */
  label: string
}

export interface RuleSection {
  /** Route slug — page lives at /rules/{slug} */
  slug: string
  /** Section number from the SRD table of contents */
  number: string
  /** Display title */
  title: string
  /** One-line summary shown on the /rules landing page */
  summary: string
  /** Anchored sub-sections in display order */
  anchors: RuleAnchor[]
  /** True for in-progress / placeholder pages (renders a "forthcoming" notice) */
  stub?: boolean
}

export const RULE_SECTIONS: RuleSection[] = [
  {
    slug: 'overview',
    number: '01',
    title: 'Overview',
    summary: 'What XSE is, who it\'s for, and the core dice & naming conventions.',
    anchors: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'key-features', label: 'Key Features of XSE' },
      { id: 'naming-conventions', label: 'Dice & Naming Conventions' },
    ],
  },
  {
    slug: 'core-mechanics',
    number: '02',
    title: 'Core Mechanics',
    summary: 'Dice Checks, modifiers, Insight Dice, Filling In The Gaps, Making The Case.',
    anchors: [
      { id: 'dice-check', label: 'Dice Check Outcomes' },
      { id: 'modifiers', label: 'Modifiers (AMod, SMod, CMod)' },
      { id: 'insight-dice', label: 'Insight Dice' },
      { id: 'filling-in-the-gaps', label: 'Filling In The Gaps' },
      { id: 'making-the-case', label: 'Making The Case' },
      { id: 'attribute-checks', label: 'Attribute, Group, Opposed Checks' },
      { id: 'first-impressions', label: 'First Impressions' },
    ],
  },
  {
    slug: 'character-overview',
    number: '03',
    title: 'Character Overview',
    summary: 'RAPID Range Attributes, Skills, Secondary Stats.',
    anchors: [
      { id: 'rapid', label: 'RAPID Range Attributes' },
      { id: 'skills', label: 'Skills' },
      { id: 'secondary-stats', label: 'Secondary Stats' },
      { id: 'fleshing-out', label: 'Fleshing A Character Out' },
    ],
  },
  {
    slug: 'character-creation',
    number: '04',
    title: 'Character Creation',
    summary: 'Backstory generation, Paradigms, pregens, and Character Evolution.',
    anchors: [
      { id: 'backstory-generation', label: 'Backstory Generation' },
      { id: 'paradigms', label: 'Paradigms & Pregens' },
      { id: 'character-evolution', label: 'Character Evolution' },
    ],
  },
  {
    slug: 'skills',
    number: '05',
    title: 'Skills',
    summary: 'The full skill list with attribute pairings and level descriptions.',
    anchors: [
      { id: 'skill-list', label: 'Skill List' },
      { id: 'inspiration', label: 'Inspiration' },
      { id: 'psychology', label: 'Psychology*' },
    ],
  },
  {
    slug: 'combat',
    number: '06',
    title: 'Combat',
    summary: 'Combat rounds, Range, Damage, Incapacitation, Stress & Breaking Point.',
    anchors: [
      { id: 'combat-rounds', label: 'Combat Rounds' },
      { id: 'range', label: 'Range' },
      { id: 'damage', label: 'Damage' },
      { id: 'incapacitation', label: 'Incapacitation' },
      { id: 'stress', label: 'Stress & Breaking Point' },
    ],
  },
  {
    slug: 'equipment',
    number: '07',
    title: 'Weapons & Equipment',
    summary: 'Weapon stats, item conditions, traits, and upkeep.',
    anchors: [
      { id: 'item-condition', label: 'Item Condition' },
      { id: 'item-traits', label: 'Item Traits' },
      { id: 'upkeep', label: 'Upkeep' },
    ],
  },
  {
    slug: 'communities',
    number: '08',
    title: 'Communities',
    summary: 'Recruitment, Apprentices, Morale Checks, Community Structure & dissolution.',
    anchors: [
      { id: 'recruitment', label: 'Recruitment Check' },
      { id: 'apprentices', label: 'Apprentices' },
      { id: 'morale', label: 'Morale Check' },
      { id: 'structure', label: 'Community Structure' },
      { id: 'crb-additions', label: 'Distemper CRB additions' },
    ],
    // not a stub — full content
  },
  {
    slug: 'appendix-tables',
    number: 'A',
    title: 'Appendix A — Tables',
    summary: 'All reference tables in one place: outcomes, modifiers, traits.',
    anchors: [],
  },
  {
    slug: 'appendix-skills',
    number: 'B',
    title: 'Appendix B — Skills',
    summary: 'The full skill catalog with descriptions.',
    anchors: [],
  },
  {
    slug: 'appendix-equipment',
    number: 'C',
    title: 'Appendix C — Weapons & Equipment',
    summary: 'Weapon stats, equipment lists, and item traits in detail.',
    anchors: [],
  },
  {
    slug: 'appendix-paradigms',
    number: 'D',
    title: 'Appendix D — Paradigms',
    summary: 'The 12 Distemper Paradigms and Vibe Shifts.',
    anchors: [],
  },
]

export function findSection(slug: string): RuleSection | undefined {
  return RULE_SECTIONS.find(s => s.slug === slug)
}
