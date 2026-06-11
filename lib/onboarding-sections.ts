// Single source for the four onboarding sections shown in both
// WelcomeModal and /firsttimers. Update here to keep both surfaces in sync.

export interface OnboardingSection {
  emoji: string
  title: string
  body: string[]
  list?: string[]
}

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  {
    emoji: '🧬',
    title: 'Create Your Survivor',
    body: [
      'Build a character through Backstory Generation - spend Character Development Points across the chapters of their life, defining where they grew up, what they learned, and how they made their way before and after.',
      'Experienced players can use the Quick Character Generator to spend 20 CDP and customize directly. Every character has a story before the story begins; here is where you write yours.',
    ],
  },
  {
    emoji: '🗺️',
    title: 'The World Map',
    body: [
      'The interactive map is the backbone of the living, breathing Tapestry. Players and GMs drop pins to mark locations, leave notes, and submit Rumors for others to substantiate.',
      'It is here that groups can write the story of this dark new world and shape the history yet to come.',
    ],
  },
  {
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
    emoji: '🎲',
    title: 'Play at The Table',
    body: [
      'The Story Table is The Tapestry\'s purpose-built virtual tabletop for Distemper.',
      'Run sessions, share artifacts and custom maps, roll dice through your character sheet, and track the party in real time.',
    ],
  },
]
