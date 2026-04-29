'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { useSearchParams } from 'next/navigation'
import CharacterCard, { LiveState } from '../../components/CharacterCard'
import ProgressionLog, { LogEntry } from '../../components/ProgressionLog'

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
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)

  useEffect(() => {
    async function load() {
      if (!characterId) { setLoading(false); return }
      const { user } = await getCachedAuth()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // Load character
      const { data: char } = await supabase.from('characters').select('*').eq('id', characterId).single()
      if (!char) { setLoading(false); return }
      setCharacter(char)
      setNotes(char.data?.session_notes ?? '')

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
        isGM={isGM}
        onStatUpdate={stateId ? async (_sid: string, field: string, value: number) => {
          await supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
        } : undefined}
        onRoll={(campaignId && (isMySheet || isGM)) ? (label, amod, smod, weapon) => {
          // Skills / attacks clicked in the popout broadcast to the parent
          // table tab over BroadcastChannel — the table tab owns the roll
          // modal + initiative gates + CMod stack, so reuse it. Same-browser
          // same-origin only; if the user's table tab isn't open, the click
          // is a no-op (UX gap to revisit if it bites).
          const prefixed = (!isMySheet && isGM && character?.name && !label.startsWith(character.name))
            ? `${character.name} — ${label}`
            : label
          const ch = new BroadcastChannel(`roll-requests-${campaignId}`)
          ch.postMessage({ label: prefixed, amod, smod, weapon })
          ch.close()
        } : undefined}
      />

      {/* Session Notes */}
      <div style={{ marginTop: '16px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px' }}>
        <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Session Notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Keep track of what's happening..."
          rows={6}
          style={{ width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
        <button onClick={async () => {
          if (!character) return
          setNotesSaving(true)
          await supabase.from('characters').update({ data: { ...character.data, session_notes: notes } }).eq('id', character.id)
          setNotesSaving(false)
        }} disabled={notesSaving}
          style={{ marginTop: '6px', padding: '6px 16px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: notesSaving ? 'not-allowed' : 'pointer', opacity: notesSaving ? 0.5 : 1 }}>
          {notesSaving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>

      {/* Progression Log — full view */}
      {character && (
        <div style={{ marginTop: '16px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px' }}>
          <ProgressionLog
            characterId={character.id}
            log={character.data?.progression_log ?? []}
            canEdit={isMySheet || isGM}
            compact={false}
            onUpdate={async (newLog: LogEntry[]) => {
              const newData = { ...character.data, progression_log: newLog }
              await supabase.from('characters').update({ data: newData }).eq('id', character.id)
              setCharacter({ ...character, data: newData })
            }}
          />
        </div>
      )}
    </div>
  )
}
