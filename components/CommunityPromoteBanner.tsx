'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { updateCommunity } from '../lib/data/community'
import { appendProgressionEntry } from '../lib/progression-log'
import { logEvent } from '../lib/events'
import { combinedMemberCount, COMMUNITY_THRESHOLD } from '../lib/community-stage'

// Phase 3 of recruit-into-a-Group: the at-13 promotion prompt. Lives in its
// own component so CampaignCommunity (a ratcheted god-component) doesn't grow.
// The parent only mounts this once a group has reached the canon threshold and
// the viewer is the GM or the group's leader, so this component owns just the
// name draft + the stage-flip write.
interface Props {
  communityId: string
  campaignId: string
  // Party size (active campaign PCs) + this group's recruited NPC members.
  // PCs aren't enrolled by the recruit flow, so they're counted separately.
  pcCount: number
  npcCount: number
  // Founder PC's character_id, if one is enrolled (recruit-founded groups have
  // none) - used for a best-effort progression-log journey marker.
  founderCharacterId: string | null
  onPromoted: () => void | Promise<void>
}

export default function CommunityPromoteBanner({ communityId, campaignId, pcCount, npcCount, founderCharacterId, onPromoted }: Props) {
  const [name, setName] = useState('')
  const [promoting, setPromoting] = useState(false)
  const combined = combinedMemberCount(pcCount, npcCount)
  const trimmed = name.trim()

  async function handlePromote() {
    if (!trimmed) { alert('Give the new Community a name first.'); return }
    if (!confirm(`Promote this group into the Community "${trimmed}"? This unlocks Morale checks, publishing, and role coverage, and it stays a Community from here on.`)) return
    setPromoting(true)
    const { error } = await updateCommunity(communityId, { stage: 'community', name: trimmed })
    if (error) { setPromoting(false); alert(`Promotion failed: ${error.message}`); return }
    void logEvent('community_promoted', { id: communityId, name: trimmed, campaign_id: campaignId })
    // Best-effort journey marker; recruit-founded groups have no PC member, so
    // it silently skips when there's no founder character.
    if (founderCharacterId) {
      const supabase = createClient()
      void appendProgressionEntry(supabase, founderCharacterId, 'community', `🏛️ Their group grew into the Community ${trimmed}.`)
    }
    setPromoting(false)
    await onPromoted()
  }

  return (
    <div style={{ padding: '12px 14px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '14px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
        ⬆ Ready to become a Community
      </div>
      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
        Your party ({pcCount} PC{pcCount === 1 ? '' : 's'}) plus {npcCount} recruited NPC{npcCount === 1 ? '' : 's'} makes {combined}. A group becomes a Community at {COMMUNITY_THRESHOLD}. Name it to unlock Morale checks, publishing, and role coverage.
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Name the new Community"
          style={{ flex: 1, minWidth: '180px', padding: '8px 10px', background: '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box' }} />
        <button
          onClick={handlePromote}
          disabled={promoting || !trimmed}
          style={{ padding: '8px 16px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: promoting ? 'wait' : 'pointer', fontWeight: 700, opacity: trimmed ? 1 : 0.5 }}>
          {promoting ? 'Promoting…' : 'Promote to Community'}
        </button>
      </div>
    </div>
  )
}
