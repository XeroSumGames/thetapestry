// AuthorBadge — compact "<avatar circle> username" pair shown next to
// authored content (forum posts, war stories, LFG cards, replies).
// Pure presentation; the calling page owns the data fetch and passes
// the hydrated username + avatar URL down. This keeps the component
// stateless and lets pages batch profile queries rather than firing
// one per badge.
//
// Empty/missing avatarUrl falls back to a colored circle with the
// first letter of the username, mirroring the sidebar's account row.

import React from 'react'

export interface AuthorBadgeProps {
  username: string | null | undefined
  avatarUrl?: string | null
  size?: number          // px diameter, default 20
  emphasis?: boolean     // bold + brighter color (e.g. for op headers)
  // Optional accent override for the fallback circle. Defaults to the
  // purple "account" color used in the sidebar.
  accent?: string
}

export default function AuthorBadge({
  username,
  avatarUrl,
  size = 20,
  emphasis = false,
  accent = '#5a2e5a',
}: AuthorBadgeProps) {
  const name = username || 'unknown'
  const initial = (name[0] ?? '?').toUpperCase()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', verticalAlign: 'middle' }}>
      <span style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: avatarUrl ? `url(${avatarUrl}) center/cover` : '#2a1a3e',
        border: `1px solid ${accent}`,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#c4a7f0',
        fontFamily: 'Carlito, sans-serif',
        fontSize: `${Math.max(13, Math.floor(size * 0.55))}px`,
        fontWeight: 700,
        lineHeight: 1,
      }}>
        {!avatarUrl && initial}
      </span>
      <span style={{
        fontSize: '13px',
        color: emphasis ? '#f5f2ee' : '#cce0f5',
        fontWeight: emphasis ? 700 : 400,
        fontFamily: 'Carlito, sans-serif',
        letterSpacing: '.02em',
      }}>
        {name}
      </span>
    </span>
  )
}
