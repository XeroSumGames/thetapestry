'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useSearchParams } from 'next/navigation'
import CharacterCard, { LiveState } from '../../components/CharacterCard'

export default function CharacterSheetPage() {
  const supabase = createClient()
  const params = useSearchParams()
  const campaignId = params.get('c')
  const characterId = params.get('char')
  const [character, setCharacter] = useState<any>(null)
  const [liveState, setLiveState] = useState<LiveState | null>(null)
  const [stateId, setStateId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isGM, setIsGM] = useState(false)
  const [isMySheet, setIsMySheet] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!characterId) { setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // Load character
      const { data: char } = await supabase.from('characters').select('*').eq('id', characterId).single()
      if (!char) { setLoading(false); return }
      setCharacter(char)

      // Check GM status
      if (campaignId) {
        const { data: camp } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).single()
        if (camp) setIsGM(camp.gm_user_id === user.id)
      }

      // Check ownership
      setIsMySheet(char.user_id === user.id)

      // Load live state if in a campaign
      if (campaignId) {
        const { data: state } = await supabase.from('character_states').select('*').eq('campaign_id', campaignId).eq('character_id', characterId).maybeSingle()
        if (state) {
          setStateId(state.id)
          setLiveState({
            wp_current: state.wp_current, wp_max: state.wp_max,
            rp_current: state.rp_current, rp_max: state.rp_max,
            stress: state.stress, insight_dice: state.insight_dice,
            morality: state.morality, cdp: state.cdp ?? 0,
            death_countdown: state.death_countdown, incap_rounds: state.incap_rounds,
          } as LiveState)
        }
      }
      setLoading(false)
    }
    load()

    // Realtime sync on character_states
    if (!campaignId || !characterId) return
    const channel = supabase.channel(`charsheet_${characterId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'character_states', filter: `character_id=eq.${characterId}` }, (payload: any) => {
        const s = payload.new
        if (s) {
          setLiveState({
            wp_current: s.wp_current, wp_max: s.wp_max,
            rp_current: s.rp_current, rp_max: s.rp_max,
            stress: s.stress, insight_dice: s.insight_dice,
            morality: s.morality, cdp: s.cdp ?? 0,
            death_countdown: s.death_countdown, incap_rounds: s.incap_rounds,
          } as LiveState)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters', filter: `id=eq.${characterId}` }, (payload: any) => {
        if (payload.new) setCharacter(payload.new)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [campaignId, characterId])

  if (loading) return <div style={{ background: '#0f0f0f', color: '#cce0f5', minHeight: '100vh', padding: '2rem', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
  if (!character) return <div style={{ background: '#0f0f0f', color: '#f5a89a', minHeight: '100vh', padding: '2rem', fontFamily: 'Barlow, sans-serif' }}>Character not found.</div>

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', padding: '16px' }}>
      <CharacterCard
        character={character}
        liveState={liveState ?? undefined}
        canEdit={isMySheet || isGM}
        showButtons={true}
        isMySheet={isMySheet}
        onStatUpdate={stateId ? async (_sid: string, field: string, value: number) => {
          await supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
        } : undefined}
      />
    </div>
  )
}
