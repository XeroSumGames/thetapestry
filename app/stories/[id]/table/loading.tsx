// Route-level Suspense boundary for /stories/[id]/table.
//
// The table page is a 9k-line 'use client' component that pulls in 30+
// child components and ~600KB of JS. On a soft-nav into this route, the
// browser sits on the OLD page's content until the new chunk finishes
// downloading + parsing — anywhere from a few hundred ms on a fast
// connection to several seconds on a cold deploy. Without this file the
// user has no signal that anything's happening.
//
// Matches the in-page `if (loading || !campaign)` fallback character-
// for-character so there's no visual swap when the route component
// finally mounts and starts its own data fetch.
export default function Loading() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Barlow, sans-serif',
      color: '#cce0f5',
      background: '#0f0f0f',
    }}>
      Loading The Table...
    </div>
  )
}
