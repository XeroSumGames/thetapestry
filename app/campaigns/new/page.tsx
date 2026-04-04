'use client'
import { useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { useRouter } from 'next/navigation'

const SETTINGS = [
  { value: 'custom', label: 'New Setting' },
  { value: 'district0', label: 'District Zero' },
  { value: 'mongrels', label: 'Minnie & The Magnificent Mongrels' },
  { value: 'chased', label: 'Chased' },
  { value: 'empty', label: 'Empty' },
  { value: 'therock', label: 'The Rock' },
]

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function NewCampaignPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [setting, setSetting] = useState('district0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in.'); setSaving(false); return }
    const invite_code = generateCode()
    const { data, error: err } = await supabase.from('campaigns').insert({
      name: name.trim(),
      description: description.trim(),
      setting,
      gm_user_id: user.id,
      invite_code,
      status: 'active',
    }).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    // GM auto-joins as member
    await supabase.from('campaign_members').insert({
      campaign_id: data.id,
      user_id: user.id,
    })
    router.push(`/campaigns/${data.id}`)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px',
    color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>

      <div style={{ borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          New Campaign
        </div>
      </div>

      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.5rem', borderLeft: '3px solid #c0392b' }}>

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Campaign Name</label>
          <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Kansas City Survivors" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={lbl}>Setting</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {SETTINGS.map(s => (
              <button key={s.value} onClick={() => setSetting(s.value)}
                style={{ flex: 1, padding: '8px', border: `1px solid ${setting === s.value ? '#c0392b' : '#3a3a3a'}`, background: setting === s.value ? '#2a1210' : '#242424', borderRadius: '3px', color: setting === s.value ? '#f5a89a' : '#d4cfc9', cursor: 'pointer', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={lbl}>Description <span style={{ color: '#5a5550', fontWeight: 400 }}>(optional)</span></label>
          <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of your campaign..." />
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: '#f5a89a', padding: '8px 10px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleCreate} disabled={saving || !name.trim()}
            style={{ flex: 1, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}>
            {saving ? 'Creating...' : 'Create Campaign'}
          </button>
          <button onClick={() => router.back()}
            style={{ padding: '10px 20px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>

      </div>
    </div>
  )
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  color: '#d4cfc9', textTransform: 'uppercase', letterSpacing: '.08em',
  marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif',
}
