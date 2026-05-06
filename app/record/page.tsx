'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { useRouter } from 'next/navigation'

// /record — admin UI for the playtest event recorder. Lets a thriver
// flip recording on/off site-wide and target specific players. Reads
// and writes the singleton row in playtest_recorder_config (id=1).
//
// RLS enforces that only thriver-role users can write; we still gate
// the UI client-side so non-thrivers see "Not authorized" instead of
// a save button that silently no-ops.

interface PlayerRow {
  id: string
  username: string | null
  email: string | null
  role: string | null
  characterNames: string[]
}

const lbl: React.CSSProperties = { fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.08em' }
const card: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '14px' }
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px',
  color: '#f5f2ee', fontSize: '14px', cursor: 'pointer',
  fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700,
}
const btnGhost: React.CSSProperties = {
  padding: '6px 12px', background: 'none', border: '1px solid #555', borderRadius: '3px',
  color: '#cce0f5', fontSize: '13px', cursor: 'pointer',
  fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase',
}

export default function RecorderConfigPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [isThriver, setIsThriver] = useState(false)
  const [meId, setMeId] = useState<string | null>(null)

  const [enabled, setEnabledLocal] = useState(false)
  const [mode, setMode] = useState<'everyone' | 'selected'>('everyone')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const { user } = await getCachedAuth()
      if (cancelled) return
      if (!user) {
        setAuthChecked(true)
        return
      }
      setMeId(user.id)
      const { data: prof } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const thriver = ((prof as any)?.role ?? '').toLowerCase() === 'thriver'
      if (cancelled) return
      setIsThriver(thriver)
      setAuthChecked(true)
      if (!thriver) return

      // Load config + user/character list in parallel.
      const [cfgRes, profRes, charRes] = await Promise.all([
        supabase.from('playtest_recorder_config').select('enabled, target_user_ids').eq('id', 1).maybeSingle(),
        supabase.from('profiles').select('id, username, email, role').order('username', { ascending: true }),
        supabase.from('characters').select('id, name, user_id'),
      ])
      if (cancelled) return

      const cfg = cfgRes.data as { enabled?: boolean; target_user_ids?: string[] } | null
      setEnabledLocal(!!cfg?.enabled)
      const targets = cfg?.target_user_ids ?? []
      setMode(targets.length === 0 ? 'everyone' : 'selected')
      setSelectedIds(new Set(targets))

      const charsByUser = new Map<string, string[]>()
      for (const c of (charRes.data ?? []) as Array<{ user_id: string; name: string }>) {
        if (!c.user_id) continue
        const arr = charsByUser.get(c.user_id) ?? []
        arr.push(c.name)
        charsByUser.set(c.user_id, arr)
      }
      const rows: PlayerRow[] = ((profRes.data ?? []) as Array<{ id: string; username: string | null; email: string | null; role: string | null }>).map(p => ({
        id: p.id,
        username: p.username,
        email: p.email,
        role: p.role,
        characterNames: charsByUser.get(p.id) ?? [],
      }))
      setPlayers(rows)
      setLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [supabase])

  const filteredPlayers = useMemo(() => {
    const f = filter.trim().toLowerCase()
    if (!f) return players
    return players.filter(p =>
      (p.username ?? '').toLowerCase().includes(f) ||
      (p.email ?? '').toLowerCase().includes(f) ||
      p.characterNames.some(n => n.toLowerCase().includes(f))
    )
  }, [players, filter])

  function toggleSelected(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  async function save() {
    setSaving(true)
    setSavedAt(null)
    const targets = mode === 'everyone' ? [] : Array.from(selectedIds)
    const { error } = await supabase
      .from('playtest_recorder_config')
      .update({
        enabled,
        target_user_ids: targets,
        updated_at: new Date().toISOString(),
        updated_by: meId,
      })
      .eq('id', 1)
    setSaving(false)
    if (error) {
      alert(`Save failed: ${error.message}`)
      return
    }
    setSavedAt(new Date().toLocaleTimeString())
  }

  if (!authChecked) {
    return (
      <div style={{ padding: 24, color: '#cce0f5', fontFamily: 'Carlito, sans-serif', fontSize: 13 }}>
        Checking authorization…
      </div>
    )
  }
  if (!isThriver) {
    return (
      <div style={{ padding: 24, fontFamily: 'Carlito, sans-serif' }}>
        <div style={{ fontSize: 18, color: '#f5f2ee', marginBottom: 8 }}>Not authorized</div>
        <div style={{ fontSize: 13, color: '#cce0f5', marginBottom: 16 }}>
          The /record page is restricted to thriver-role admins. If that's
          you and this is wrong, your role isn't loading — check the profiles
          table.
        </div>
        <button onClick={() => router.push('/')} style={btnGhost}>Home</button>
      </div>
    )
  }

  const totalSelected = selectedIds.size

  return (
    <div style={{ background: '#0f0f0f', color: '#f5f2ee', minHeight: '100vh', fontFamily: 'Carlito, sans-serif', padding: '20px' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ borderBottom: '2px solid #c0392b', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: 4 }}>
            Admin · Playtest Recorder
          </div>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: 28, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            Recording Configuration
          </div>
          <div style={{ fontSize: 13, color: '#cce0f5', marginTop: 6, fontFamily: 'Carlito, sans-serif', maxWidth: 700 }}>
            Controls who runs the in-app event recorder. When OFF, no one records.
            When ON with no targets selected, every authenticated user records.
            With targets, only the selected players record (across every page they visit).
          </div>
        </div>

        {/* Master toggle */}
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={lbl}>Recording</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <button
              onClick={() => setEnabledLocal(v => !v)}
              style={{
                padding: '8px 22px',
                background: enabled ? '#27ae60' : '#3a3a3a',
                border: `1px solid ${enabled ? '#27ae60' : '#555'}`,
                borderRadius: 3,
                color: '#f5f2ee', fontSize: 14, cursor: 'pointer',
                fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700,
              }}
            >
              {enabled ? 'ON' : 'OFF'}
            </button>
            <span style={{ fontSize: 13, color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>
              {enabled ? 'Recorder is active for the selected scope below.' : 'Recorder is off — nobody captures events.'}
            </span>
          </div>
        </div>

        {/* Scope: everyone or selected */}
        <div style={{ ...card, marginBottom: 14, opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
          <div style={lbl}>Scope</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 14, fontFamily: 'Carlito, sans-serif' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="radio" name="mode" checked={mode === 'everyone'} onChange={() => setMode('everyone')} />
              <span>Everyone (all signed-in users)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="radio" name="mode" checked={mode === 'selected'} onChange={() => setMode('selected')} />
              <span>Selected players only ({totalSelected})</span>
            </label>
          </div>
        </div>

        {/* Selected-players list */}
        {enabled && mode === 'selected' && (
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={lbl}>Players ({filteredPlayers.length} of {players.length})</div>
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter by name, email, or character…"
                style={{
                  width: 320, padding: '6px 10px', background: '#242424',
                  border: '1px solid #3a3a3a', borderRadius: 3,
                  color: '#f5f2ee', fontSize: 13, fontFamily: 'Carlito, sans-serif',
                }}
              />
            </div>
            {loading ? (
              <div style={{ fontSize: 13, color: '#888', padding: 8 }}>Loading…</div>
            ) : (
              <div style={{ maxHeight: 480, overflowY: 'auto', border: '1px solid #2e2e2e', borderRadius: 3 }}>
                {filteredPlayers.map((p, i) => {
                  const isMe = p.id === meId
                  const checked = selectedIds.has(p.id)
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 1fr',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        background: i % 2 === 0 ? '#161616' : '#1c1c1c',
                        borderBottom: '1px solid #232323',
                      }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleSelected(p.id)} />
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', fontWeight: 600 }}>
                          {p.username || '(no username)'}
                          {isMe && <span style={{ marginLeft: 6, fontSize: 13, color: '#EF9F27' }}>(you)</span>}
                        </span>
                        <span style={{ fontSize: 13, color: '#cce0f5', fontFamily: 'Carlito, sans-serif' }}>{p.email}</span>
                        {p.role && p.role.toLowerCase() === 'thriver' && (
                          <span style={{ fontSize: 13, color: '#EF9F27', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>thriver</span>
                        )}
                        {p.characterNames.length > 0 && (
                          <span style={{ fontSize: 13, color: '#9aa', fontFamily: 'Carlito, sans-serif' }}>
                            chars: {p.characterNames.join(', ')}
                          </span>
                        )}
                      </div>
                    </label>
                  )
                })}
                {filteredPlayers.length === 0 && (
                  <div style={{ fontSize: 13, color: '#888', padding: 14, textAlign: 'center' }}>
                    No players match "{filter}".
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => setSelectedIds(new Set(filteredPlayers.map(p => p.id)))} style={btnGhost}>Select all visible</button>
              <button onClick={() => setSelectedIds(new Set())} style={btnGhost}>Clear all</button>
            </div>
          </div>
        )}

        {/* Save bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18 }}>
          <button onClick={save} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {savedAt && (
            <span style={{ fontSize: 13, color: '#27ae60', fontFamily: 'Carlito, sans-serif' }}>
              Saved at {savedAt}. Open tabs apply on next page load.
            </span>
          )}
        </div>

        <div style={{ marginTop: 28, fontSize: 13, color: '#888', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5 }}>
          <div style={{ marginBottom: 6 }}><strong style={{ color: '#cce0f5' }}>Hotkeys (active when recording):</strong></div>
          <div>· Ctrl+Shift+L — dump buffer to JSON file</div>
          <div>· Ctrl+Shift+M — mark a moment with a label</div>
          <div>· Ctrl+Shift+P — peek last 20 events in console</div>
          <div style={{ marginTop: 10, fontSize: 12 }}>
            Buffer holds the last 2,000 events per tab. The tiny red dot in
            the bottom-right corner is the visual indicator that recording is
            on for this user.
          </div>
        </div>
      </div>
    </div>
  )
}
