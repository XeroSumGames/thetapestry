'use client'
// /gm-notes-popout — comprehensive GM-side overview of a campaign.
// Opens as a popout window from two surfaces: the GM Notes button
// on /stories/[id] and the GM Tools dropdown on /table. Designed to
// sit on a second monitor while the GM runs the session — story
// overview, plot beats, scenes, NPC list, pins, all in one scroll.
//
// Read-only for v1. Plot beats use the existing campaign_notes
// table (the GM's running notes) — no new schema. Edits still
// happen on the existing /table GM Notes panel; this popout just
// surfaces the data alongside scenes/NPCs/pins for at-a-glance
// session prep.

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
        {campaign.description && (
          <p style={{ fontSize: '14px', color: '#d4cfc9', marginTop: '8px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {campaign.description}
          </p>
        )}
      </div>

      {/* Plot beats / running notes (campaign_notes) */}
      <Section title="Plot Beats &amp; Notes" count={notes.length} emptyText="No notes yet — open the GM Notes panel on /table to add some.">
        {notes.map(n => (
          <Card key={n.id}>
            {n.title && <div style={cardTitleStyle}>{n.title}</div>}
            <div style={{ fontSize: '13px', color: '#d4cfc9', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
              {renderRichText(n.content)}
            </div>
          </Card>
        ))}
      </Section>

      {/* Scenes */}
      <Section title="Tactical Scenes" count={scenes.length} emptyText="No scenes yet — set one up on /table → Map Setup.">
        {scenes.map(s => (
          <Card key={s.id}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <div style={cardTitleStyle}>{s.name}</div>
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
                    <div style={cardTitleStyle}>{n.name}</div>
                    {n.status === 'dead' && <span style={chipStyle('#2a1210', '#f5a89a', '#7a1f16')}>Dead</span>}
                    {n.npc_type && <span style={chipStyle('#2a2010', '#EF9F27', '#5a4a1b')}>{n.npc_type}</span>}
                    {n.disposition && <span style={chipStyle(n.disposition === 'hostile' ? '#2a1210' : '#1a2e10', n.disposition === 'hostile' ? '#f5a89a' : '#7fc458', n.disposition === 'hostile' ? '#7a1f16' : '#2d5a1b')}>{n.disposition}</span>}
                    {n.hidden_from_players && <span style={chipStyle('#1a1a1a', '#5a5550', '#3a3a3a')}>Hidden</span>}
                  </div>
                  {n.motivation && (
                    <div style={{ fontSize: '13px', color: '#cce0f5', marginTop: '4px', fontStyle: 'italic' }}>
                      <span style={{ color: '#888' }}>Motivation: </span>{n.motivation}
                    </div>
                  )}
                  {n.notes && (
                    <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '4px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {n.notes.length > 280 ? n.notes.slice(0, 280) + '…' : n.notes}
                    </div>
                  )}
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
              {p.sort_order != null && <span style={{ color: '#EF9F27', fontFamily: 'Carlito, sans-serif', fontSize: '13px', fontWeight: 700 }}>#{p.sort_order}</span>}
              <div style={cardTitleStyle}>{p.name}</div>
              <span style={chipStyle('#1a1a2e', '#7ab3d4', '#2e2e5a')}>{p.category}</span>
              {!p.revealed && <span style={chipStyle('#1a1a1a', '#5a5550', '#3a3a3a')}>Hidden</span>}
            </div>
            {p.notes && (
              <div style={{ fontSize: '13px', color: '#d4cfc9', marginTop: '4px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {p.notes.length > 240 ? p.notes.slice(0, 240) + '…' : p.notes}
              </div>
            )}
          </Card>
        ))}
      </Section>

      <div style={{ fontSize: '13px', color: '#5a5550', textAlign: 'center', marginTop: '24px', fontStyle: 'italic' }}>
        Read-only overview. Edits happen on the main /table page.
      </div>
    </div>
  )
}

// ── Style helpers ─────────────────────────────────────────────────

const shellStyle: React.CSSProperties = {
  background: '#0f0f0f',
  color: '#f5f2ee',
  minHeight: '100vh',
  padding: '20px 24px',
  fontFamily: 'Barlow, sans-serif',
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
