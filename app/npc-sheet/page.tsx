'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { wrapBroadcast, wrapDbChange } from '../../lib/sentry-realtime'
import { getCachedAuth } from '../../lib/auth-cache'
import { useSearchParams } from 'next/navigation'
import NpcCard from '../../components/NpcCard'
import PlayerNpcCard from '../../components/PlayerNpcCard'
import type { CampaignNpc } from '../../components/NpcRoster'
import { getCampaignNpcById } from '../../lib/data/campaign-npcs'

export default function NpcSheetPage() {
  const supabase = createClient()
  const params = useSearchParams()
  const campaignId = params.get('c')
  const npcId = params.get('npc')
  // Opener passes &gm=1 or &gm=0 because it already knows the viewer's role.
  // When the hint is present (the common case), we skip the auth.getUser() +
  // campaigns gm_user_id round-trips entirely - the popout used to do three
  // sequential queries on mount before rendering anything; with this hint
  // it does one. Falls back to a runtime check for old bookmarked URLs that
  // predate the hint. Security: GM vs Player view is purely a UI selection,
  // all mutations are RLS-gated server-side, so a forged &gm=1 cannot bypass
  // permissions.
  const gmHint = params.get('gm')
  const [npc, setNpc] = useState<CampaignNpc | null>(null)
  const [loading, setLoading] = useState(true)
  const [isGM, setIsGM] = useState(gmHint === '1')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!npcId) { setLoading(false); return }
      // Run the NPC fetch and (if needed) the role-check fetches in parallel,
      // not serially. Saves up to two round-trips of latency on cold opens.
      const npcPromise = supabase.from('campaign_npcs').select('*').eq('id', npcId).maybeSingle()
      const rolePromise = (gmHint == null && campaignId)
        ? (async () => {
            const { user } = await getCachedAuth()
            if (!user) return null
            const { data: camp } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
            return !!camp && camp.gm_user_id === user.id
          })()
        : Promise.resolve(null)
      const [{ data: npcData }, roleResult] = await Promise.all([npcPromise, rolePromise])
      if (cancelled) return
      setNpc(npcData as CampaignNpc | null)
      if (roleResult !== null) setIsGM(roleResult)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [npcId, campaignId, gmHint])

  // Force the popout to the right size for the viewer's role. window.open
  // ignores width/height when a window with the same name was opened before
  // (Chrome remembers the last geometry per name), so changing the size in
  // the openPopout call alone doesn't fix already-cached windows. resizeTo
  // applies once we know the role.
  useEffect(() => {
    if (loading) return
    if (typeof window === 'undefined') return
    if (!window.opener) return  // not actually a popout
    try {
      window.resizeTo(isGM ? 571 : 140, isGM ? 400 : 140)
    } catch { /* some browsers block resizeTo on already-shown windows; harmless */ }
  }, [loading, isGM])

  useEffect(() => {
    if (!npcId) return
    // Realtime sync - two channels, both converging to the same setNpc:
    //   postgres_changes UPDATE - reliable but can lag 0.5-2s on busy projects.
    //   npc_damaged broadcast - fires instantly from whichever client dealt
    //     the damage on the campaign's initiative channel. This is how the
    //     main table page updates in real time; subscribing here too means
    //     the popout window no longer lags behind the attacker's main tab.
    // Catch-up refetch. The npc_damaged broadcast is fire-and-forget and the
    // postgres_changes UPDATE can be dropped on a backgrounded socket, so a
    // client that dropped/late-joined/was-hidden can miss a damage event and
    // show stale WP/RP until refresh. Re-pull the row on each channel's
    // SUBSCRIBED (re)connect and on tab-return-to-visible.
    async function refetchNpc() {
      if (!npcId) return
      const { data } = await getCampaignNpcById(npcId)
      if (data) setNpc(data as CampaignNpc)
    }
    const postgresCh = supabase.channel(`npcsheet_${npcId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_npcs', filter: `id=eq.${npcId}` }, wrapDbChange('campaign_npcs', (payload: any) => {
        if (payload.new) setNpc(payload.new as CampaignNpc)
      }))
      .subscribe((status: string) => { if (status === 'SUBSCRIBED') void refetchNpc() })
    const broadcastCh = campaignId
      ? supabase.channel(`initiative_${campaignId}`)
          .on('broadcast', { event: 'npc_damaged' }, wrapBroadcast('npc_damaged', (msg: any) => {
            const { npcId: n, patch } = msg.payload ?? {}
            if (n === npcId && patch) setNpc(prev => prev ? ({ ...prev, ...patch } as CampaignNpc) : prev)
          }))
          .subscribe((status: string) => { if (status === 'SUBSCRIBED') void refetchNpc() })
      : null
    function handleVisibility() { if (!document.hidden) void refetchNpc() }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(postgresCh)
      if (broadcastCh) supabase.removeChannel(broadcastCh)
    }
  }, [npcId, campaignId])

  if (loading) {
    return <div style={{ background: '#0f0f0f', color: '#cce0f5', minHeight: '100vh', padding: '2rem', fontFamily: 'Carlito, sans-serif' }}>Loading…</div>
  }
  if (!npc) {
    return <div style={{ background: '#0f0f0f', color: '#f5a89a', minHeight: '100vh', padding: '2rem', fontFamily: 'Carlito, sans-serif' }}>NPC not found.</div>
  }

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', padding: '12px' }}>
      {isGM ? (
        <NpcCard
          npc={npc}
          onClose={() => window.close()}
          // Edit / Map / Publish / Popout hidden in the popout itself - they
          // only make sense back in the table page's Asset panel. Restore and
          // Stabilize still work because they hit Supabase directly.
        />
      ) : (
        <PlayerNpcCard npc={npc} onClose={() => window.close()} />
      )}
    </div>
  )
}
