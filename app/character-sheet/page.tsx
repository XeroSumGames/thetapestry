'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { wrapDbChange } from '../../lib/sentry-realtime'
import { getCachedAuth } from '../../lib/auth-cache'
import { isThriver as roleIsThriver } from '../../lib/auth/roles'
import { useSearchParams } from 'next/navigation'
import CharacterCard, { LiveState } from '../../components/CharacterCard'
import ProgressionLog, { LogEntry } from '../../components/ProgressionLog'
import { resizeImage } from '../../lib/image-utils'
import { uploadCharacterPortrait, removeCharacterPortrait } from '../../lib/data/character-portrait'

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
  const [isThriver, setIsThriver] = useState(false)
  const [isMySheet, setIsMySheet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [portraitUploading, setPortraitUploading] = useState(false)
  const [portraitError, setPortraitError] = useState<string | null>(null)
  const portraitInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      if (!characterId) { setLoading(false); return }
      const { user } = await getCachedAuth()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // Load character - include portrait_url for the map-token flow
      const { data: char } = await supabase.from('characters').select('id,user_id,name,created_at,data,portrait_url').eq('id', characterId).single()
      if (!char) { setLoading(false); return }
      setCharacter(char)
      setNotes(char.data?.session_notes ?? '')

      // Check GM status + Thriver role in parallel
      const [campRes, profRes] = await Promise.all([
        campaignId ? supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).single() : Promise.resolve({ data: null }),
        supabase.from('profiles').select('role').eq('id', user.id).single(),
      ])
      if (campRes.data) setIsGM((campRes.data as any).gm_user_id === user.id)
      if (profRes.data) setIsThriver(roleIsThriver(profRes.data))

      // Check ownership
      setIsMySheet(char.user_id === user.id)

      // Load live state if in a campaign
      if (campaignId) {
        const { data: state } = await supabase.from('character_states').select('id,wp_current,wp_max,rp_current,rp_max,stress,insight_dice,morality,cdp,death_countdown,incap_rounds,recovering_from_mortal_wound,infection_state,infection_days_left,infection_lasting_risk,infection_started_at,infection_infected_by,infection_severity,infection_pending_lasting_check').eq('campaign_id', campaignId).eq('character_id', characterId).maybeSingle()
        if (state) {
          setStateId(state.id)
          setLiveState({
            id: state.id,
            wp_current: state.wp_current, wp_max: state.wp_max,
            rp_current: state.rp_current, rp_max: state.rp_max,
            stress: state.stress, insight_dice: state.insight_dice,
            morality: state.morality, cdp: state.cdp ?? 0,
            death_countdown: state.death_countdown, incap_rounds: state.incap_rounds,
            infection_state: state.infection_state ?? null,
            infection_days_left: state.infection_days_left ?? null,
            infection_lasting_risk: !!state.infection_lasting_risk,
            infection_started_at: state.infection_started_at ?? null,
            infection_infected_by: state.infection_infected_by ?? null,
            infection_severity: state.infection_severity ?? null,
            infection_pending_lasting_check: !!state.infection_pending_lasting_check,
          })
        }
      }
      setLoading(false)
    }
    load()

    // Realtime sync on character_states
    if (!campaignId || !characterId) return
    const channel = supabase.channel(`charsheet_${characterId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'character_states', filter: `character_id=eq.${characterId}` }, wrapDbChange('character_states', (payload: any) => {
        const s = payload.new
        if (s) {
          setLiveState({
            id: s.id,
            wp_current: s.wp_current, wp_max: s.wp_max,
            rp_current: s.rp_current, rp_max: s.rp_max,
            stress: s.stress, insight_dice: s.insight_dice,
            morality: s.morality, cdp: s.cdp ?? 0,
            death_countdown: s.death_countdown, incap_rounds: s.incap_rounds,
            recovering_from_mortal_wound: !!s.recovering_from_mortal_wound,
            infection_state: s.infection_state ?? null,
            infection_days_left: s.infection_days_left ?? null,
            infection_lasting_risk: !!s.infection_lasting_risk,
            infection_started_at: s.infection_started_at ?? null,
            infection_infected_by: s.infection_infected_by ?? null,
            infection_severity: s.infection_severity ?? null,
            infection_pending_lasting_check: !!s.infection_pending_lasting_check,
          })
        }
      }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'characters', filter: `id=eq.${characterId}` }, wrapDbChange('characters', (payload: any) => {
        if (payload.new) setCharacter(payload.new)
      }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [campaignId, characterId])

  // Upload a portrait to the character-portraits bucket and sync to
  // characters.portrait_url so the table page can use it as a map token.
  async function handlePortraitUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !character || !userId) return
    if (!file.type.startsWith('image/')) { setPortraitError('Not an image file.'); return }
    setPortraitError(null)
    setPortraitUploading(true)
    try {
      const dataUrl = await resizeImage(file, 256)
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const result = await uploadCharacterPortrait(supabase, blob, userId, character.id, character.data)
      if ('error' in result) { setPortraitError(result.error); setPortraitUploading(false); return }
      setCharacter({ ...character, portrait_url: result.publicUrl, data: { ...character.data, photoDataUrl: result.publicUrl } })
    } catch (err: any) {
      setPortraitError(err?.message ?? 'Upload failed')
    }
    setPortraitUploading(false)
  }

  async function handlePortraitRemove() {
    if (!character) return
    await removeCharacterPortrait(supabase, character.id, character.data)
    setCharacter({ ...character, portrait_url: null, data: { ...character.data, photoDataUrl: '' } })
  }

  const portraitUrl = character?.portrait_url ?? character?.data?.photoDataUrl ?? null

  if (loading) return <div style={{ background: '#0f0f0f', color: '#cce0f5', minHeight: '100vh', padding: '2rem', fontFamily: 'Carlito, sans-serif' }}>Loading...</div>
  if (!character) return <div style={{ background: '#0f0f0f', color: '#f5a89a', minHeight: '100vh', padding: '2rem', fontFamily: 'Carlito, sans-serif' }}>Character not found.</div>

  return (
    <div style={{ background: '#0f0f0f', minHeight: '100vh', padding: '16px' }}>
      <CharacterCard
        character={character}
        liveState={liveState ?? undefined}
        canEdit={isMySheet || isGM || isThriver}
        showButtons={true}
        isMySheet={isMySheet}
        isGM={isGM}
        onStatUpdate={stateId ? async (_sid: string, field: string, value: number | string | boolean | null) => {
          await supabase.from('character_states').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', stateId)
        } : undefined}
        onRoll={(campaignId && (isMySheet || isGM || isThriver)) ? (label, amod, smod, weapon) => {
          // Skills / attacks clicked in the popout broadcast to the parent
          // table tab over BroadcastChannel - the table tab owns the roll
          // modal + initiative gates + CMod stack, so reuse it. Same-browser
          // same-origin only; if the user's table tab isn't open, the click
          // is a no-op (UX gap to revisit if it bites).
          const prefixed = (!isMySheet && isGM && character?.name && !label.startsWith(character.name))
            ? `${character.name} - ${label}`
            : label
          const ch = new BroadcastChannel(`roll-requests-${campaignId}`)
          ch.postMessage({ label: prefixed, amod, smod, weapon })
          ch.close()
        } : undefined}
      />

      {/* Portrait / Map Token - owner or GM can set the photo used as the
          map token when the GM places this PC on the tactical scene. */}
      {(isMySheet || isGM) && (
        <div style={{ marginTop: '16px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px' }}>
          <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Portrait / Map Token</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {portraitUrl
              ? <img src={portraitUrl} alt="Portrait" style={{ width: '72px', height: '72px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #3a3a3a', flexShrink: 0 }} />
              : <div style={{ width: '72px', height: '72px', borderRadius: '50%', border: '1px dashed #3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#f5f2ee', flexShrink: 0 }}>No photo</div>
            }
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', lineHeight: 1.4 }}>
                This photo appears as the map token when placed on the tactical scene.
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => portraitInputRef.current?.click()}
                  disabled={portraitUploading}
                  style={{ padding: '6px 14px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: portraitUploading ? 'wait' : 'pointer', opacity: portraitUploading ? 0.5 : 1 }}>
                  {portraitUploading ? 'Uploading...' : (portraitUrl ? 'Replace photo' : 'Upload photo')}
                </button>
                {portraitUrl && (
                  <button onClick={handlePortraitRemove} disabled={portraitUploading}
                    style={{ padding: '6px 14px', background: '#2a1210', border: '1px solid #5a2418', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Remove
                  </button>
                )}
              </div>
              {portraitError && <div style={{ fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif' }}>{portraitError}</div>}
              <input ref={portraitInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePortraitUpload} />
            </div>
          </div>
        </div>
      )}

      {/* Session Notes */}
      <div style={{ marginTop: '16px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '12px' }}>
        <div style={{ fontSize: '14px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}>Session Notes</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Keep track of what's happening..."
          rows={6}
          style={{ width: '100%', padding: '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
        <button onClick={async () => {
          if (!character) return
          setNotesSaving(true)
          await supabase.from('characters').update({ data: { ...character.data, session_notes: notes } }).eq('id', character.id)
          setNotesSaving(false)
        }} disabled={notesSaving}
          style={{ marginTop: '6px', padding: '6px 16px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: notesSaving ? 'not-allowed' : 'pointer', opacity: notesSaving ? 0.5 : 1 }}>
          {notesSaving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>

      {/* Progression Log - full view */}
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
