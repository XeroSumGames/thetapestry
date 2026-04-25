import type { Metadata } from 'next'

// Forums metadata. Both the index page and the [id] thread page are
// Client Components, so this layout's metadata is what link scrapers
// see for any /campfire/forums and /campfire/forums/<id> URL.
//
// Per-thread OG (so a shared thread URL previews with that thread's
// title) would require converting the thread page to a server component
// or splitting it into a server wrapper. Out of scope for v1; site-
// level OG still beats a bare URL preview.

export const metadata: Metadata = {
  title: 'Forums',
  description: 'Community threads — lore discussion, rules questions, session recaps, and everything in between. The Tapestry community boards.',
  openGraph: {
    title: 'Forums — The Tapestry',
    description: 'Community threads — lore, rules, session recaps, and more.',
  },
  twitter: {
    title: 'Forums — The Tapestry',
    description: 'Community threads — lore, rules, session recaps, and more.',
  },
}

export default function ForumsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
