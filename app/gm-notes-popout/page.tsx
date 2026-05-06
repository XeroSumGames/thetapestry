'use client'
// /gm-notes-popout — comprehensive GM-side overview of a campaign.
// Opens as a popout window from two surfaces: the GM Notes button
// on /stories/[id] and the GM Tools dropdown on /table.
//
// Every field a GM might tweak mid-session is click-to-edit. Edits
// persist via .update().select() against the backing tables —
// campaigns / campaign_notes / tactical_scenes / campaign_npcs /
// campaign_pins — same RLS as /table. Optimistic UI: change shows
// instantly, reverts + alerts if the write rejects.

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { renderRichText } from '../../lib/rich-text'

interface Campaign {
  id: string
  name: string
  description: string | null
  setting: string | null
  gm_user_id: string
}

interface Scene {
  id: string
  name: string
  is_active: boolean
  grid_cols: number
  grid_rows: number
  lighting_mode?: string | null
}

interface Npc {
  id: string
  name: string
  npc_type: string | null
  status: string
  disposition: string | null
  motivation: string | null
  notes: string | null
  folder: string | null
  hidden_from_players: boolean
}

interface Pin {
  id: string
  name: string
  category: string
  notes: string | null
  revealed: boolean
  sort_order: number | null
}

interface Note {
  id: string
  title: string
  content: string
  sort_order: number | null
}

export default function GMNotesPopoutPage() {
  const supabase = createClient()
  const params = useSearchParams()
  const campaignId = params.get('c')

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [scenes, setScenes] = useState<Scene[]>([])
  const [npcs, setNpcs] = useState<Npc[]>([])
  const [pins, setPins] = useState<Pin[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { user } = await getCachedAuth()
      if (!user) { if (!cancelled) { setAuthError('Sign in required.'); setLoading(false) } ; return }
      // GM gate — only the campaign's GM (or a Thriver via godmode RLS)
      // can see this popout. Non-GM members shouldn't read plot beats
      // since those usually contain spoilers.
      const { data: camp } = await supabase
        .from('campaigns')
        .select('id, name, description, setting, gm_user_id')
        .eq('id', campaignId)
        .maybeSingle()
      if (!camp) { if (!cancelled) { setAuthError('Campaign not found.'); setLoading(false) } ; return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const isGM = (camp as Campaign).gm_user_id === user.id
      const isThriver = (profile as any)?.role?.toLowerCase() === 'thriver'
      if (!isGM && !isThriver) {
        if (!cancelled) { setAuthError('GM access only.'); setLoading(false) }
        return
      }
      if (cancelled) return
      setCampaign(camp as Campaign)

      // Parallel fetch — scenes, NPCs, pins, notes. Each table has its
      // own RLS that the GM passes; no point serializing.
      const [scenesR, npcsR, pinsR, notesR] = await Promise.all([
        supabase.from('tactical_scenes').select('id, name, is_active, grid_cols, grid_rows, lighting_mode').eq('campaign_id', campaignId).order('created_at', { ascending: true }),
        supabase.from('campaign_npcs').select('id, name, npc_type, status, disposition, motivation, notes, folder, hidden_from_players').eq('campaign_id', campaignId).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
        supabase.from('campaign_pins').select('id, name, category, notes, revealed, sort_order').eq('campaign_id', campaignId).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
        supabase.from('campaign_notes').select('id, title, content, sort_order').eq('campaign_id', campaignId).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
      ])
      if (cancelled) return
      setScenes((scenesR.data ?? []) as Scene[])
      setNpcs((npcsR.data ?? []) as Npc[])
      setPins((pinsR.data ?? []) as Pin[])
      setNotes((notesR.data ?? []) as Note[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [supabase, campaignId])

  // ── Save helpers (optimistic + rollback on RLS reject) ────────────
  // Every mutation rolls forward the local cache, fires .update().select()
  // to surface RLS rejections (vs. fire-and-forget which would silently
  // drop them), and rolls back if the write fails.

  async function saveCampaign(field: keyof Campaign, value: any) {
    if (!campaign) return
    const prev = (campaign as any)[field]
    setCampaign({ ...campaign, [field]: value })
    const { error } = await supabase.from('campaigns').update({ [field]: value }).eq('id', campaign.id).select()
    if (error) {
      alert(`Save failed: ${error.message}`)
      setCampaign({ ...campaign, [field]: prev })
    }
  }

  async function saveNote(id: string, field: keyof Note, value: any) {
    const prev = notes.find(n => n.id === id)
    if (!prev) return
    setNotes(notes.map(n => n.id === id ? { ...n, [field]: value } : n))
    const { error } = await supabase.from('campaign_notes').update({ [field]: value }).eq('id', id).select()
    if (error) {
      alert(`Save failed: ${error.message}`)
      setNotes(notes.map(n => n.id === id ? prev : n))
    }
  }

  async function saveScene(id: string, field: keyof Scene, value: any) {
    const prev = scenes.find(s => s.id === id)
    if (!prev) return
    setScenes(scenes.map(s => s.id === id ? { ...s, [field]: value } : s))
    const { error } = await supabase.from('tactical_scenes').update({ [field]: value }).eq('id', id).select()
    if (error) {
      alert(`Save failed: ${error.message}`)
      setScenes(scenes.map(s => s.id === id ? prev : s))
    }
  }

  async function saveNpc(id: string, field: keyof Npc, value: any) {
    const prev = npcs.find(n => n.id === id)
    if (!prev) return
    setNpcs(npcs.map(n => n.id === id ? { ...n, [field]: value } : n))
    const { error } = await supabase.from('campaign_npcs').update({ [field]: value }).eq('id', id).select()
    if (error) {
      alert(`Save failed: ${error.message}`)
      setNpcs(npcs.map(n => n.id === id ? prev : n))
    }
  }

  async function savePin(id: string, field: keyof Pin, value: any) {
    const prev = pins.find(p => p.id === id)
    if (!prev) return
    setPins(pins.map(p => p.id === id ? { ...p, [field]: value } : p))
    const { error } = await supabase.from('campaign_pins').update({ [field]: value }).eq('id', id).select()
    if (error) {
      alert(`Save failed: ${error.message}`)
      setPins(pins.map(p => p.id === id ? prev : p))
    }
  }

  if (!campaignId) {
    return <div style={shellStyle}><div style={{ padding: '2rem', color: '#f5a89a' }}>Missing campaign id. URL must include `?c=&lt;campaignId&gt;`.</div></div>
  }
  if (loading) {
    return <div style={shellStyle}><div style={{ padding: '2rem', color: '#cce0f5' }}>Loading…</div></div>
  }
  if (authError) {
    return <div style={shellStyle}><div style={{ padding: '2rem', color: '#f5a89a' }}>{authError}</div></div>
  }
  if (!campaign) {
    return <div style={shellStyle}><div style={{ padding: '2rem', color: '#f5a89a' }}>Campaign not found.</div></div>
  }

  // Group NPCs by folder so the GM's organization carries through.
  const npcsByFolder = new Map<string, Npc[]>()
  for (const n of npcs) {
    const key = n.folder ?? 'Unfiled'
    const list = npcsByFolder.get(key) ?? []
    list.push(n)
    npcsByFolder.set(key, list)
  }

  return (
    <div style={shellStyle}>
      {/* Header */}
      <div style={{ borderBottom: '2px solid #c0392b', paddingBottom: '12px', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>GM Notes — Story Overview</div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee' }}>{campaign.name}</div>
        <EditableText
          value={campaign.description ?? ''}
          onSave={v => saveCampaign('description', v || null)}
          multiline
          emptyPlaceholder="Add a campaign description…"
          textStyle={{ fontSize: '14px', color: '#d4cfc9', marginTop: '8px', lineHeight: 1.6, whiteSpace: 'pre-wrap', display: 'block' }}
        />
      </div>

      {/* Plot beats / running notes (campaign_notes) */}
      <Section title="Plot Beats &amp; Notes" count={notes.length} emptyText="No notes yet — open the GM Notes panel on /table to add some.">
        {notes.map(n => (
          <Card key={n.id}>
            <EditableText
              value={n.title ?? ''}
              onSave={v => saveNote(n.id, 'title', v)}
              emptyPlaceholder="Untitled beat"
              textStyle={cardTitleStyle}
            />
            <EditableText
              value={n.content ?? ''}
              onSave={v => saveNote(n.id, 'content', v)}
              multiline
              emptyPlaceholder="Add note content…"
              displayContent={renderRichText(n.content)}
              textStyle={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, whiteSpace: 'pre-wrap', display: 'block', marginTop: '4px' }}
            />
          </Card>
        ))}
      </Section>

      {/* Scenes */}
      <Section title="Tactical Scenes" count={scenes.length} emptyText="No scenes yet — set one up on /table → Map Setup.">
        {scenes.map(s => (
          <Card key={s.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <EditableText
                value={s.name ?? ''}
                onSave={v => saveScene(s.id, 'name', v || 'Untitled Scene')}
                emptyPlaceholder="Untitled Scene"
                textStyle={cardTitleStyle}
              />
              {s.is_active && <span style={chipStyle('#1a2e10', '#7fc458', '#2d5a1b')}>Active</span>}
              <span style={chipStyle('#1a1a2e', '#7ab3d4', '#2e2e5a')}>
                {s.grid_cols} × {s.grid_rows}
              </span>
              {s.lighting_mode && (
                <span style={chipStyle(s.lighting_mode === 'day' ? '#2a2010' : '#0f1a2e', s.lighting_mode === 'day' ? '#EF9F27' : '#7ab3d4', s.lighting_mode === 'day' ? '#5a4a1b' : '#2e2e5a')}>
                  {s.lighting_mode === 'day' ? '🌞 Day' : '🌙 Night'}
                </span>
              )}
            </div>
          </Card>
        ))}
      </Section>

      {/* NPCs grouped by folder */}
      <Section title="NPCs" count={npcs.length} emptyText="No NPCs yet.">
        {Array.from(npcsByFolder.entries()).map(([folder, list]) => (
          <div key={folder} style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
              {folder} <span style={{ color: '#5a5550' }}>· {list.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {list.map(n => (
                <Card key={n.id}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                    <EditableText
                      value={n.name ?? ''}
                      onSave={v => saveNpc(n.id, 'name', v || 'Unnamed NPC')}
                      emptyPlaceholder="Unnamed NPC"
                      textStyle={cardTitleStyle}
                    />
                    {n.status === 'dead' && <span style={chipStyle('#2a1210', '#f5a89a', '#7a1f16')}>Dead</span>}
                    <EditableText
                      value={n.npc_type ?? ''}
                      onSave={v => saveNpc(n.id, 'npc_type', v || null)}
                      emptyPlaceholder="+ type"
                      textStyle={chipStyle('#2a2010', '#EF9F27', '#5a4a1b')}
                    />
                    <EditableSelect
                      value={n.disposition ?? ''}
                      options={[
                        { value: '', label: '—' },
                        { value: 'friendly', label: 'Friendly' },
                        { value: 'neutral', label: 'Neutral' },
                        { value: 'hostile', label: 'Hostile' },
                      ]}
                      onSave={v => saveNpc(n.id, 'disposition', v || null)}
                      chipStyle={chipStyle(
                        n.disposition === 'hostile' ? '#2a1210' : n.disposition === 'friendly' ? '#1a2e10' : '#1a1a1a',
                        n.disposition === 'hostile' ? '#f5a89a' : n.disposition === 'friendly' ? '#7fc458' : '#cce0f5',
                        n.disposition === 'hostile' ? '#7a1f16' : n.disposition === 'friendly' ? '#2d5a1b' : '#3a3a3a'
                      )}
                    />
                    <EditableToggle
                      value={n.hidden_from_players}
                      onSave={v => saveNpc(n.id, 'hidden_from_players', v)}
                      onLabel="Hidden"
                      offLabel="Visible"
                      onChip={chipStyle('#1a1a1a', '#cce0f5', '#3a3a3a')}
                      offChip={chipStyle('#1a2e10', '#7fc458', '#2d5a1b')}
                    />
                  </div>
                  <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px', fontStyle: 'italic' }}>
                    <span style={{ color: '#888' }}>Motivation: </span>
                    <EditableText
                      value={n.motivation ?? ''}
                      onSave={v => saveNpc(n.id, 'motivation', v || null)}
                      emptyPlaceholder="Add motivation…"
                      textStyle={{ fontSize: '13px', color: '#cce0f5', fontStyle: 'italic' }}
                    />
                  </div>
                  <EditableText
                    value={n.notes ?? ''}
                    onSave={v => saveNpc(n.id, 'notes', v || null)}
                    multiline
                    emptyPlaceholder="Add notes…"
                    textStyle={{ fontSize: '13px', color: '#d4cfc9', marginTop: '4px', lineHeight: 1.5, whiteSpace: 'pre-wrap', display: 'block' }}
                  />
                </Card>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* Pins */}
      <Section title="Pins" count={pins.length} emptyText="No pins yet — drop them on the campaign map.">
        {pins.map(p => (
          <Card key={p.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <EditableNumber
                value={p.sort_order}
                onSave={v => savePin(p.id, 'sort_order', v)}
                prefix="#"
                emptyPlaceholder="#?"
                textStyle={{ color: '#EF9F27', fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 700 }}
              />
              <EditableText
                value={p.name ?? ''}
                onSave={v => savePin(p.id, 'name', v || 'Unnamed Pin')}
                emptyPlaceholder="Unnamed Pin"
                textStyle={cardTitleStyle}
              />
              <span style={chipStyle('#1a1a2e', '#7ab3d4', '#2e2e5a')}>{p.category}</span>
              <EditableToggle
                value={p.revealed}
                onSave={v => savePin(p.id, 'revealed', v)}
                onLabel="Revealed"
                offLabel="Hidden"
                onChip={chipStyle('#1a2e10', '#7fc458', '#2d5a1b')}
                offChip={chipStyle('#1a1a1a', '#cce0f5', '#3a3a3a')}
              />
            </div>
            <EditableText
              value={p.notes ?? ''}
              onSave={v => savePin(p.id, 'notes', v || null)}
              multiline
              emptyPlaceholder="Add pin notes…"
              textStyle={{ fontSize: '13px', color: '#d4cfc9', marginTop: '4px', lineHeight: 1.5, whiteSpace: 'pre-wrap', display: 'block' }}
            />
          </Card>
        ))}
      </Section>

      <div style={{ fontSize: '13px', color: '#5a5550', textAlign: 'center', marginTop: '24px', fontStyle: 'italic' }}>
        Click any field to edit — changes save automatically. Adding new beats / NPCs / pins still happens on the main /table page.
      </div>
    </div>
  )
}

// ── Inline-edit components ────────────────────────────────────────

function EditableText({
  value,
  onSave,
  multiline,
  emptyPlaceholder,
  displayContent,
  textStyle,
}: {
  value: string
  onSave: (v: string) => void | Promise<void>
  multiline?: boolean
  emptyPlaceholder?: string
  displayContent?: React.ReactNode
  textStyle?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)

  // Sync external changes when not editing (e.g. saveX optimistic
  // update came back fresh, or another field on the same row changed).
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  async function commit() {
    if (saving) return
    if (draft === value) { setEditing(false); return }
    setSaving(true)
    try { await onSave(draft) } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  function cancel() {
    setDraft(value)
    setEditing(false)
  }

  if (editing) {
    const sharedStyle: React.CSSProperties = {
      ...textStyle,
      background: '#0f1418',
      border: '1px solid #7ab3d4',
      borderRadius: '3px',
      padding: '4px 6px',
      width: '100%',
      fontFamily: 'Carlito, sans-serif',
      outline: 'none',
      // Editing mode always full-bleed; no truncation while typing.
    }
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Escape') { e.preventDefault(); cancel() }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
          }}
          rows={Math.max(3, Math.min(12, draft.split('\n').length + 1))}
          disabled={saving}
          style={{ ...sharedStyle, resize: 'vertical' }}
        />
      )
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
          if (e.key === 'Enter') { e.preventDefault(); commit() }
        }}
        disabled={saving}
        style={sharedStyle}
      />
    )
  }

  // Display mode. Hover hint via dotted underline + cursor:text.
  const displayStyle: React.CSSProperties = {
    ...textStyle,
    cursor: 'text',
    borderBottom: '1px dotted transparent',
    transition: 'border-color .12s',
  }
  const isEmpty = !value || value.trim() === ''
  return (
    <span
      onClick={() => setEditing(true)}
      onMouseEnter={e => { e.currentTarget.style.borderBottomColor = '#3a3a3a' }}
      onMouseLeave={e => { e.currentTarget.style.borderBottomColor = 'transparent' }}
      title="Click to edit"
      style={displayStyle}
    >
      {isEmpty
        ? <span style={{ color: '#5a5550', fontStyle: 'italic' }}>{emptyPlaceholder ?? 'Click to edit'}</span>
        : (displayContent ?? value)}
    </span>
  )
}

function EditableSelect({
  value,
  options,
  onSave,
  chipStyle: chipS,
}: {
  value: string
  options: { value: string; label: string }[]
  onSave: (v: string) => void | Promise<void>
  chipStyle: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const current = options.find(o => o.value === value)
  const label = current?.label ?? '—'

  if (editing) {
    return (
      <select
        autoFocus
        value={value}
        onChange={async e => {
          const v = e.target.value
          setEditing(false)
          await onSave(v)
        }}
        onBlur={() => setEditing(false)}
        style={{
          ...chipS,
          padding: '1px 4px',
          background: '#0f1418',
          border: '1px solid #7ab3d4',
          color: '#f5f2ee',
          fontFamily: 'Carlito, sans-serif',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to change"
      style={{ ...chipS, cursor: 'pointer' }}
    >
      {label}
    </span>
  )
}

function EditableToggle({
  value,
  onSave,
  onLabel,
  offLabel,
  onChip,
  offChip,
}: {
  value: boolean
  onSave: (v: boolean) => void | Promise<void>
  onLabel: string
  offLabel: string
  onChip: React.CSSProperties
  offChip: React.CSSProperties
}) {
  return (
    <span
      onClick={() => onSave(!value)}
      title="Click to toggle"
      style={{ ...(value ? onChip : offChip), cursor: 'pointer' }}
    >
      {value ? onLabel : offLabel}
    </span>
  )
}

function EditableNumber({
  value,
  onSave,
  prefix,
  emptyPlaceholder,
  textStyle,
}: {
  value: number | null
  onSave: (v: number | null) => void | Promise<void>
  prefix?: string
  emptyPlaceholder?: string
  textStyle?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value == null ? '' : String(value))

  useEffect(() => {
    if (!editing) setDraft(value == null ? '' : String(value))
  }, [value, editing])

  async function commit() {
    const trimmed = draft.trim()
    let next: number | null = null
    if (trimmed !== '') {
      const n = parseInt(trimmed, 10)
      if (!isNaN(n)) next = n
    }
    if (next === value) { setEditing(false); return }
    await onSave(next)
    setEditing(false)
  }

  function cancel() {
    setDraft(value == null ? '' : String(value))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); cancel() }
          if (e.key === 'Enter') { e.preventDefault(); commit() }
        }}
        style={{
          ...textStyle,
          width: '60px',
          background: '#0f1418',
          border: '1px solid #7ab3d4',
          borderRadius: '3px',
          padding: '2px 4px',
          fontFamily: 'Carlito, sans-serif',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <span
      onClick={() => setEditing(true)}
      title="Click to edit order"
      style={{ ...textStyle, cursor: 'text' }}
    >
      {value == null ? (emptyPlaceholder ?? '#?') : `${prefix ?? ''}${value}`}
    </span>
  )
}

// ── Style helpers ─────────────────────────────────────────────────

const shellStyle: React.CSSProperties = {
  background: '#0f0f0f',
  color: '#f5f2ee',
  minHeight: '100vh',
  padding: '20px 24px',
  fontFamily: 'Carlito, sans-serif',
}

const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'Carlito, sans-serif',
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  color: '#f5f2ee',
}

function chipStyle(bg: string, color: string, border: string): React.CSSProperties {
  return {
    fontSize: '13px',
    padding: '1px 6px',
    borderRadius: '2px',
    background: bg,
    color,
    border: `1px solid ${border}`,
    fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
  }
}

function Section({ title, count, emptyText, children }: { title: string; count: number; emptyText: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '8px', borderBottom: '1px solid #2e2e2e', paddingBottom: '4px' }}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: `${title} <span style="color:#5a5550">· ${count}</span>` }}
      />
      {count === 0 ? (
        <div style={{ fontSize: '13px', color: '#5a5550', fontStyle: 'italic', padding: '8px 0' }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>
      )}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '10px 12px' }}>
      {children}
    </div>
  )
}
