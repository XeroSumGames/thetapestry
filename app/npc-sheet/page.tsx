'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import NpcCard from '../../components/NpcCard'
import type { CampaignNpc } from '../../components/NpcRoster'

export default function NpcSheetPage() {
  const supabase = createClient()
  const params = useSearchParams()
  const campaignId = params.get('c')
  const npcId = params.get('npc')
  const [npc, setNpc] = useState<CampaignNpc | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!npcId) { setLoading(false); return }
      const { data } = await supabase.from('campaign_npcs').select('*').eq('id', npcId).maybeSingle()
      setNpc(data as CampaignNpc | null)
      setLoading(false)
    }
    load()

    if (!npcId) return
    // Realtime sync — two channels, both converging to the same setNpc:
    //   postgres_changes UPDATE — reliable but can lag 0.5-2s on busy projects.
    //   npc_damaged broadcast — fires instantly from whichever client dealt
    //     the damage on the campaign's initiative channel. This is how the
    //     main table page updates in real time; subscribing here too means
    //     the popout window no longer lags behind the attacker's main tab.
    const postgresCh = supabase.channel(`npcsheet_${npcId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_npcs', filter: `id=eq.${npcId}` }, (payload: any) => {
        if (payload.new) setNpc(payload.new as CampaignNpc)
      })
      .subscribe()
    const broadcastCh = campaignId
      ? supabase.channel(`initiative_${campaignId}`)
          .on('broadcast', { event: 'npc_damaged' }, (msg: any) => {
            const { npcId: n, patch } = msg.payload ?? {}
            if (n === npcId && patch) setNpc(prev => prev ? ({ ...prev, ...patch } as CampaignNpc) : prev)
          })
          .subscribe()
      : null
    return () => {
      supabase.removeChannel(postgresCh)
      if (broadcastCh) supabase.removeChannel(broadcastCh)
    }
  }, [npcId, campaignId])

  if (loading) {
    return <div style={{ background: '#0f0f0f', color: '#cce0f5', minHeight: '100vh', padding: '2rem', fontFamily: 'Barlow, sans-serif' }}>Loading…</div>
  }
  if (!npc) {
    return <div style={{ background: '#0f0f0f', color: '#f5a89a', minHeight: '100vh', padding: '2rem', fontFamily: 'Barlow, sans-serif' }}>NPC not found.</div>
  }

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', padding: '12px' }}>
      <NpcCard
        npc={npc}
        onClose={() => window.close()}
        // Edit / Map / Publish / Popout hidden in the popout itself — they
        // only make sense back in the table page's Asset panel. Restore and
        // Stabilize still work because they hit Supabase directly.
      />
    </div>
  )
}
