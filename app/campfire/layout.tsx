import type { Metadata } from 'next'

// Per-route metadata for the Campfire hub. Server-only — sibling page.tsx
// is a Client Component, so its OG tags live here instead. Inherits
// metadataBase, og:image, og:siteName etc. from app/layout.tsx; only
// overrides what's specific to this surface.

export const metadata: Metadata = {
  title: 'The Campfire',
  description: 'The meta layer — where players, GMs, and visitors connect across campaigns. Messages, Looking for Group, Forums, and more.',
  openGraph: {
    title: 'The Campfire — The Tapestry',
    description: 'The meta layer — where players, GMs, and visitors connect across campaigns.',
  },
  twitter: {
    title: 'The Campfire — The Tapestry',
    description: 'The meta layer — where players, GMs, and visitors connect across campaigns.',
  },
}

export default function CampfireLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
