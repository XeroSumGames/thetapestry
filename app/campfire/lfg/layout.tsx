import type { Metadata } from 'next'

// LFG bulletin-board metadata. The page itself is a Client Component
// (interactive list with composer + share popovers), so this server-only
// sibling layout is what scrapers (Discord, Reddit, X, Facebook) read
// when someone shares a link to /campfire/lfg.

export const metadata: Metadata = {
  title: 'Looking for Group',
  description: 'Find a Distemper campaign to join, or post that your table needs players. Cross-campaign GM/player matchmaking on The Tapestry.',
  openGraph: {
    title: 'Looking for Group — The Tapestry',
    description: 'Find a Distemper campaign to join, or post that your table needs players.',
  },
  twitter: {
    title: 'Looking for Group — The Tapestry',
    description: 'Find a Distemper campaign to join, or post that your table needs players.',
  },
}

export default function LfgLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
