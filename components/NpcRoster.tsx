'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase-browser'

const RAPID_LABELS: Record<number, string> = {
  [-2]: 'Diminished', [-1]: 'Weak', 0: 'Average', 1: 'Good',
  2: 'Strong', 3: 'Exceptional', 4: 'Human Peak',
}

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  friendly: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  goon: { bg: '#2a2010', border: '#5a4a1b', color: '#EF9F27' },
  foe: { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  antagonist: { bg: '#2a102a', border: '#8b2e8b', color: '#d48bd4' },
}

const ROLE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  cohort: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  conscript: { bg: '#2a2010', border: '#5a4a1b', color: '#EF9F27' },
  convert: { bg: '#1a1a2e', border: '#2e2e5a', color: '#7ab3d4' },
  apprentice: { bg: '#1a2e2e', border: '#1b5a5a', color: '#58c4c4' },
}

const TYPE_PRESETS: Record<string, { reason: number; acumen: number; physicality: number; influence: number; dexterity: number }> = {
  friendly: { reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 0 },
  goon: { reason: 0, acumen: 0, physicality: 1, influence: 0, dexterity: 0 },
  foe: { reason: 0, acumen: 1, physicality: 1, influence: 0, dexterity: 1 },
}

const SKILL_HINTS: Record<string, string> = {
  goon: 'Goons typically have up to 3 skills at level 1.',
  foe: 'Foes typically have two skills at level 2 and three at level 1.',
  antagonist: 'Antagonists typically have one skill at 3, two at 2, three at 1.',
}

const STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  active: { bg: '#1a2e10', border: '#2d5a1b', color: '#7fc458' },
  dead: { bg: '#2a1210', border: '#c0392b', color: '#f5a89a' },
  unknown: { bg: '#1a1a2e', border: '#2e2e5a', color: '#7ab3d4' },
}

export interface CampaignNpc {
  id: string
  campaign_id: string
  name: string
  portrait_url: string | null
  reason: number
  acumen: number
  physicality: number
  influence: number
  dexterity: number
  skills: any
  notes: string | null
  npc_type: string | null
  recruitment_role: string | null
  status: string
  created_at: string
}

interface Props {
  campaignId: string
  isGM: boolean
}

const emptyForm = {
  name: '', portrait_url: null as string | null,
  reason: 0, acumen: 0, physicality: 0, influence: 0, dexterity: 0,
  skills: '', notes: '', status: 'active',
  npc_type: '' as string, recruitment_role: '' as string,
}

export default function NpcRoster({ campaignId, isGM }: Props) {
  const supabase = createClient()
  const [npcs, setNpcs] = useState<CampaignNpc[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function loadNpcs() {
    const { data } = await supabase
      .from('campaign_npcs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
    setNpcs(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (isGM) loadNpcs()
    else setLoading(false)
  }, [campaignId, isGM])

  if (!isGM) return null

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(npc: CampaignNpc) {
    setForm({
      name: npc.name,
      portrait_url: npc.portrait_url,
      reason: npc.reason,
      acumen: npc.acumen,
      physicality: npc.physicality,
      influence: npc.influence,
      dexterity: npc.dexterity,
      skills: typeof npc.skills === 'string' ? npc.skills : (npc.skills?.text ?? ''),
      notes: npc.notes ?? '',
      status: npc.status,
      npc_type: npc.npc_type ?? '',
      recruitment_role: npc.recruitment_role ?? '',
    })
    setEditingId(npc.id)
    setShowForm(true)
  }

  async function handlePortraitUpload(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${campaignId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('campaign-npcs').upload(path, file)
    if (!error) {
      const { data: urlData } = supabase.storage.from('campaign-npcs').getPublicUrl(path)
      setForm(f => ({ ...f, portrait_url: urlData.publicUrl }))
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    const row = {
      campaign_id: campaignId,
      name: form.name.trim(),
      portrait_url: form.portrait_url,
      reason: form.reason,
      acumen: form.acumen,
      physicality: form.physicality,
      influence: form.influence,
      dexterity: form.dexterity,
      skills: { text: form.skills },
      notes: form.notes.trim() || null,
      status: form.status,
      npc_type: form.npc_type || null,
      recruitment_role: form.recruitment_role || null,
    }
    if (editingId) {
      await supabase.from('campaign_npcs').update(row).eq('id', editingId)
    } else {
      await supabase.from('campaign_npcs').insert(row)
    }
    setShowForm(false)
    setSaving(false)
    await loadNpcs()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return
    await supabase.from('campaign_npcs').delete().eq('id', id)
    await loadNpcs()
  }

  function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  function handleTypeChange(type: string) {
    setForm(f => {
      const preset = TYPE_PRESETS[type]
      if (preset) {
        return { ...f, npc_type: type, ...preset }
      }
      return { ...f, npc_type: type }
    })
  }

  const rapidField = (label: string, key: keyof typeof form, short: string) => (
    <div style={{ flex: 1, minWidth: '60px' }}>
      <div style={{ fontSize: '9px', color: '#5a5550', letterSpacing: '.06em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '3px', textAlign: 'center' }}>{short}</div>
      <select value={form[key] as number} onChange={e => setForm(f => ({ ...f, [key]: parseInt(e.target.value) }))}
        style={{ width: '100%', padding: '4px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', appearance: 'none' }}>
        {[-2, -1, 0, 1, 2, 3, 4].map(v => (
          <option key={v} value={v}>{v > 0 ? `+${v}` : v} {RAPID_LABELS[v]}</option>
        ))}
      </select>
    </div>
  )

  return (
    <>
      {/* NPC List */}
      <div style={{ width: '240px', flexShrink: 0, borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #2e2e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '10px', fontWeight: 600, color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'Barlow Condensed, sans-serif' }}>NPC Roster</span>
          <button onClick={openAdd}
            style={{ padding: '2px 8px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '9px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + Add
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#5a5550', fontSize: '11px' }}>Loading...</div>
          ) : npcs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
              <div style={{ fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>No NPCs yet</div>
            </div>
          ) : (
            npcs.map(npc => {
              const sc = STATUS_COLORS[npc.status] ?? STATUS_COLORS.active
              return (
                <div key={npc.id} onClick={() => openEdit(npc)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '4px', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}
                >
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#2a1210', border: '1px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {npc.portrait_url ? (
                      <img src={npc.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: '9px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{getInitials(npc.name)}</span>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{npc.name}</div>
                    <div style={{ display: 'flex', gap: '3px', marginTop: '2px' }}>
                      {npc.npc_type && (() => {
                        const tc = TYPE_COLORS[npc.npc_type] ?? TYPE_COLORS.goon
                        return <span style={{ fontSize: '7px', padding: '0 4px', borderRadius: '2px', background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{npc.npc_type}</span>
                      })()}
                      {npc.recruitment_role && (() => {
                        const rc = ROLE_COLORS[npc.recruitment_role] ?? ROLE_COLORS.cohort
                        return <span style={{ fontSize: '7px', padding: '0 4px', borderRadius: '2px', background: rc.bg, border: `1px solid ${rc.border}`, color: rc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em' }}>{npc.recruitment_role}</span>
                      })()}
                    </div>
                  </div>
                  <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '2px', background: sc.bg, border: `1px solid ${sc.border}`, color: sc.color, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', flexShrink: 0 }}>{npc.status}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Add/Edit NPC Modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontSize: '10px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>
              {editingId ? 'Edit NPC' : 'Add NPC'}
            </div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1rem' }}>
              {form.name || 'New NPC'}
            </div>

            {/* Portrait */}
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#2a1210', border: '2px solid #c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {form.portrait_url ? (
                  <img src={form.portrait_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#c0392b', fontFamily: 'Barlow Condensed, sans-serif' }}>{form.name ? getInitials(form.name) : '?'}</span>
                )}
              </div>
              <div>
                <label style={{ padding: '4px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  {uploading ? 'Uploading...' : 'Upload Portrait'}
                  <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) handlePortraitUpload(e.target.files[0]) }} />
                </label>
                {form.portrait_url && (
                  <button onClick={() => setForm(f => ({ ...f, portrait_url: null }))}
                    style={{ marginLeft: '6px', background: 'none', border: 'none', color: '#5a5550', fontSize: '10px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>Remove</button>
                )}
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Name</div>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' }} />
            </div>

            {/* NPC Type */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>NPC Type</div>
              <select value={form.npc_type} onChange={e => handleTypeChange(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                <option value="">No type</option>
                <option value="friendly">Friendly</option>
                <option value="goon">Goon</option>
                <option value="foe">Foe</option>
                <option value="antagonist">Antagonist</option>
              </select>
            </div>

            {/* Recruitment Role */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Recruitment Role</div>
              <select value={form.recruitment_role} onChange={e => setForm(f => ({ ...f, recruitment_role: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                <option value="">None</option>
                <option value="cohort">Cohort</option>
                <option value="conscript">Conscript</option>
                <option value="convert">Convert</option>
                <option value="apprentice">Apprentice</option>
              </select>
            </div>

            {/* RAPID */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px' }}>RAPID Attributes</div>
              {form.npc_type === 'antagonist' && (
                <div style={{ fontSize: '10px', color: '#d48bd4', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '6px', padding: '6px 8px', background: '#2a102a', border: '1px solid #8b2e8b', borderRadius: '3px' }}>
                  Choose one attribute to set to 3, two others to 2, and one to 1.
                </div>
              )}
              <div style={{ display: 'flex', gap: '4px' }}>
                {rapidField('Reason', 'reason', 'RSN')}
                {rapidField('Acumen', 'acumen', 'ACU')}
                {rapidField('Physicality', 'physicality', 'PHY')}
                {rapidField('Influence', 'influence', 'INF')}
                {rapidField('Dexterity', 'dexterity', 'DEX')}
              </div>
            </div>

            {/* Skills */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Skills</div>
              <textarea value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
                placeholder="e.g. Ranged Combat 2, Stealth 1, Melee Combat 3"
                rows={2}
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
              {form.npc_type && SKILL_HINTS[form.npc_type] && (
                <div style={{ fontSize: '10px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px', fontStyle: 'italic' }}>
                  {SKILL_HINTS[form.npc_type]}
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>GM Notes <span style={{ color: '#3a3a3a' }}>(private)</span></div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Private notes — never shown to players"
                rows={3}
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '12px', fontFamily: 'Barlow, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.5 }} />
            </div>

            {/* Status */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '10px', color: '#5a5550', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '4px' }}>Status</div>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', boxSizing: 'border-box', appearance: 'none' }}>
                <option value="active">Active</option>
                <option value="dead">Dead</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
              {editingId && (
                <button onClick={() => { handleDelete(editingId, form.name); setShowForm(false) }}
                  style={{ padding: '10px 14px', background: 'none', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Delete</button>
              )}
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
                {saving ? 'Saving...' : editingId ? 'Save' : 'Add NPC'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
