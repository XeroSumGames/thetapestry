'use client'
// StoryToolsNav — shared navigation row mounted at the top of every
// GM sub-page under /stories/[id]/* so the Launch/Edit/Snapshot/
// Sessions/Community/Share buttons stay reachable without bouncing
// back to the GM Tools hub. Mirrors the inline button row on
// /stories/[id]/page.tsx (the hub) minus the heavyweight controls
// (GM Kit, Publish Module, Archive, Delete) which keep their state
// on the hub itself.
//
// Active-page highlighting is driven by usePathname() — the matching
// button gets a brighter border + text color so the user can tell
// which sub-page they're on at a glance.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

interface Props {
  campaignId: string
  isGM: boolean
  inviteCode?: string
}

export default function StoryToolsNav({ campaignId, isGM, inviteCode }: Props) {
  const pathname = usePathname() ?? ''
  const [copied, setCopied] = useState(false)

  function copyInvite() {
    if (!inviteCode) return
    const link = `${window.location.origin}/join/${inviteCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Each entry: pathname suffix used to mark itself active.
  const isActive = (suffix: string) => pathname.endsWith(suffix)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1.25rem', alignItems: 'center' }}>
      <a href={`/stories/${campaignId}/table`} target="_blank" rel="noreferrer"
        style={btn('#c0392b', '#fff', '#c0392b', false)}>
        Launch
      </a>
      <Link href={`/stories/${campaignId}`}
        style={btn('#242424', '#f5f2ee', '#3a3a3a', isActive(`/stories/${campaignId}`) && !isActive('/edit') && !isActive('/snapshots') && !isActive('/sessions') && !isActive('/community'))}>
        GM Tools
      </Link>
      {isGM && (
        <Link href={`/stories/${campaignId}/edit`}
          style={btn('#242424', '#f5f2ee', '#3a3a3a', isActive('/edit'))}>
          Edit
        </Link>
      )}
      {isGM && (
        <Link href={`/stories/${campaignId}/snapshots`}
          style={btn('#2a2010', '#EF9F27', '#5a4a1b', isActive('/snapshots'))}>
          Snapshot
        </Link>
      )}
      {isGM && (
        <Link href={`/stories/${campaignId}/sessions`}
          style={btn('#1a3a5c', '#7ab3d4', '#1a3a5c', isActive('/sessions'))}>
          Sessions
        </Link>
      )}
      {isGM && (
        <Link href={`/stories/${campaignId}/community`}
          style={btn('#1a2e10', '#7fc458', '#2d5a1b', isActive('/community'))}>
          Community
        </Link>
      )}
      {inviteCode && (
        <button onClick={copyInvite} style={btn('#1a3a5c', '#7ab3d4', '#7ab3d4', false) as any}>
          {copied ? 'Copied!' : 'Share'}
        </button>
      )}
    </div>
  )
}

function btn(bg: string, color: string, border: string, active: boolean): React.CSSProperties {
  return {
    padding: '8px 18px',
    background: active ? lighten(bg) : bg,
    border: `1px solid ${active ? color : border}`,
    borderRadius: '3px',
    color,
    fontSize: '13px',
    fontFamily: 'Barlow Condensed, sans-serif',
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    cursor: 'pointer',
    display: 'inline-block',
    fontWeight: active ? 700 : 400,
    boxShadow: active ? `0 0 0 1px ${color} inset` : undefined,
  }
}

// Tiny helper — pump up the background so the active button stands
// out without rebuilding a parallel palette.
function lighten(hex: string): string {
  // Crude but predictable: bump each channel up by 0x10 (clamped).
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex
  const r = Math.min(0xff, parseInt(hex.slice(1, 3), 16) + 0x14)
  const g = Math.min(0xff, parseInt(hex.slice(3, 5), 16) + 0x14)
  const b = Math.min(0xff, parseInt(hex.slice(5, 7), 16) + 0x14)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
