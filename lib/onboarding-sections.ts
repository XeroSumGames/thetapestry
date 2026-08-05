// Single source for the onboarding sections shown in both the stepped
// WelcomeModal (first-visit tour on /dashboard) and the static /firsttimers
// reference page. Update here to keep both surfaces in sync.
//
// `key` is a stable id the stepped WelcomeModal uses to pull a specific
// section into a given step (and to override its title for the tour) without
// depending on array order or the display title. /firsttimers just maps the
// whole array in order, so `key` is inert there.

export interface OnboardingSection {
  key: string
  emoji: string
  title: string
  body: string[]
  list?: string[]
}

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    key: 'dashboard',
    emoji: '📋',
    title: 'The Dashboard',
    body: [
      'Your Dashboard is home base - the first thing you see each time you return. From here you jump straight to your survivors, the stories you\'re running or playing in, and everything else The Tapestry offers.',
      'Think of it as the wall of your shelter: one glance tells you where you stand, what needs attention, and where to head next.',
    ],
  },
  {
    key: 'characters',
    emoji: '🧬',
    title: 'Create Your Survivor',
    body: [
      'Build a character through Backstory Generation - spend Character Development Points across the chapters of their life, defining where they grew up, what they learned, and how they made their way before and after.',
      'Experienced players can use the Quick Character Generator to spend 20 CDP and customize directly. Every character has a story before the story begins; here is where you write yours.',
    ],
  },
  {
    key: 'campfire',
    emoji: '🔥',
    title: 'The Campfire',
    body: [
      'The Campfire is the post-apocalyptic equivalent of the town notice board - where survivors gather to share what they\'ve heard, warn others, and find people to travel with. Inside you\'ll find:',
    ],
    list: [
      'Looking for Group - players seeking a game, GMs seeking players',
      'Rumors from the map - pins surface here with extra detail',
      'War Stories - write-ups and fiction from sessions past',
      'World events - updates from the publisher and the world itself',
    ],
  },
  {
    key: 'pins',
    emoji: '🗺️',
    title: 'The World Map',
    body: [
      'The interactive map is the backbone of the living, breathing Tapestry. Players and GMs drop pins to mark locations, leave notes, and submit Rumors for others to substantiate.',
      'It is here that groups can write the story of this dark new world and shape the history yet to come.',
    ],
  },
  {
    key: 'table',
    emoji: '🎲',
    title: 'Play at The Table',
    body: [
      'The Story Table is The Tapestry\'s purpose-built virtual tabletop for Distemper.',
      'Run sessions, share artifacts and custom maps, roll dice through your character sheet, and track the party in real time.',
    ],
  },
]

// Look a section up by its stable key (used by the stepped WelcomeModal).
export function onboardingSection(key: string): OnboardingSection | undefined {
  return ONBOARDING_SECTIONS.find(s => s.key === key)
}
