'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { ModalBackdrop, Z_INDEX } from '../lib/style-helpers'

interface PortraitRow {
  id: string
  number: number
  gender: 'man' | 'woman'
  url_256: string
  url_56: string
}

interface Props {
  initialGender?: 'man' | 'woman' | 'all'
  onPick: (url: string) => void
  onClose: () => void
}

export default function PortraitBankPicker({ initialGender = 'all', onPick, onClose }: Props) {
  const supabase = createClient()
  const [filter, setFilter] = useState<'man' | 'woman' | 'all'>(initialGender)
  const [portraits, setPortraits] = useState<PortraitRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      let q = supabase.from('portrait_bank').select('id, number, gender, url_256, url_56').order('created_at', { ascending: false }).limit(200)
      if (filter !== 'all') q = q.eq('gender', filter)
      const { data } = await q
      setPortraits((data ?? []) as PortraitRow[])
      setLoading(false)
    })()
  }, [filter, supabase])

  return (
    <ModalBackdrop onClose={onClose} zIndex={10002} opacity={0.85} padding="2rem">
      <div style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '100%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ fontFamily: '"Carlito", sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#c0392b' }}>Portrait Bank</div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#d4cfc9', padding: '4px 10px', fontSize: '13px', fontFamily: '"Carlito", sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: '3px' }}>Close</button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem' }}>
          {(['all', 'man', 'woman'] as const).map(f => {
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  flex: 1, padding: '8px',
                  background: active ? '#2a1210' : '#242424',
                  border: `1px solid ${active ? '#c0392b' : '#3a3a3a'}`,
                  borderRadius: '3px',
                  color: active ? '#f5a89a' : '#d4cfc9',
                  fontSize: '13px', fontFamily: '"Carlito", sans-serif',
                  letterSpacing: '.08em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}>
                {f === 'all' ? 'All' : f === 'man' ? 'Male' : 'Female'}
              </button>
            )
          })}
        </div>

        {/* Grid */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#5a5550', fontFamily: '"Carlito", sans-serif', textTransform: 'uppercase' }}>Loading...</div>
          ) : portraits.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#5a5550', fontFamily: '"Carlito", sans-serif', fontSize: '13px' }}>
              No portraits in the bank yet.<br />
              <span style={{ fontSize: '13px' }}>Thrivers can add portraits via the Resize Portraits tool.</span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: '8px' }}>
              {portraits.map(p => (
                <button key={p.id} onClick={() => { onPick(p.url_256); onClose() }}
                  title={`NPC-${p.gender === 'man' ? 'MAN' : 'WOMAN'}-${String(p.number).padStart(3, '0')}`}
                  style={{ padding: 0, background: '#0a0a0a', border: '2px solid transparent', borderRadius: '4px', cursor: 'pointer', overflow: 'hidden' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#c0392b'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url_56} alt="" width={72} height={72} style={{ display: 'block', width: '100%', height: '72px', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalBackdrop>
  )
}
