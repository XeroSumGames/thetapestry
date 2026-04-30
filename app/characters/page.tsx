'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { useRouter } from 'next/navigation'
import CharacterCard from '../../components/CharacterCard'
import { createTestCharacter } from '../../scripts/create-test-character'

interface CharacterRow {
  id: string
  name: string
  created_at: string
  data: any
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isThriver, setIsThriver] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role?.toLowerCase() === 'thriver') setIsThriver(true)
      const { data } = await supabase
        .from('characters')
        .select('id, name, created_at, data')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setCharacters(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleDelete(id: string) {
    const char = characters.find(c => c.id === id)
    if (!confirm(`Are you sure you want to delete ${char?.name || 'this character'}? This cannot be undone.`)) return
    await supabase.from('characters').delete().eq('id', id)
    setCharacters(prev => prev.filter(c => c.id !== id))
  }

  async function handleDuplicate(c: CharacterRow) {
    const { user } = await getCachedAuth()
    if (!user) return
    await supabase.from('characters').insert({ user_id: user.id, name: `Copy of ${c.name}`, data: c.data })
    const { data } = await supabase
      .from('characters').select('id, name, created_at, data')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    setCharacters(data ?? [])
  }

  if (loading) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>Loading...</div>
  )

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          My Survivors
        </div>
        <div style={{ flex: 1 }} />
        {isThriver && (
          <button onClick={async () => {
            const result = await createTestCharacter(supabase)
            if (result) {
              const { data } = await supabase.from('characters').select('id, name, created_at, data').eq('user_id', result.user_id).order('created_at', { ascending: false })
              setCharacters(data ?? [])
            }
          }}
            style={{ padding: '7px 18px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + Test Character
          </button>
        )}
        <a href='/characters/new' style={{ padding: '7px 18px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          New Character
        </a>
      </div>

      {characters.length === 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#d4cfc9', marginBottom: '1rem' }}>No characters yet.</div>
          <a href='/characters/new' style={{ padding: '9px 22px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Create your first character
          </a>
        </div>
      )}

      {/* Gallery — portrait + name strip at the top of the page so the
          full roster is visible without scrolling through every sheet.
          Click a tile → smooth-scroll to that character's sheet below.
          Hidden when there's 0 or 1 character (no benefit).
          Layout: CSS grid with auto-fill + 1fr so tiles flex to fill
          the row evenly — kills the dead block on the right that the
          old fixed-88px flex-wrap was leaving behind. */}
      {characters.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '10px', marginBottom: '1.5rem', padding: '12px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px' }}>
          {characters.map(c => (
            <button key={`gallery-${c.id}`}
              onClick={() => {
                const el = document.getElementById(`char-${c.id}`)
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              title={`Jump to ${c.name}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '6px', width: '100%', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>
              {c.data?.photoDataUrl ? (
                <img src={c.data.photoDataUrl} alt={c.name} loading="lazy"
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '3px', border: '1px solid #3a3a3a' }} />
              ) : (
                <div style={{ width: '64px', height: '64px', background: '#161616', border: '1px solid #3a3a3a', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a5550', fontSize: '24px' }}>?</div>
              )}
              <div style={{ fontSize: '13px', color: '#f5f2ee', letterSpacing: '.04em', textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.1, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {characters.map(c => (
          <div key={c.id} id={`char-${c.id}`} style={{ scrollMarginTop: '12px' }}>
            <CharacterCard
              character={c}
              liveState={{
                id: c.id,
                wp_current: c.data?.secondary?.woundPoints ?? 10,
                wp_max: c.data?.secondary?.woundPoints ?? 10,
                rp_current: c.data?.secondary?.resiliencePoints ?? 6,
                rp_max: c.data?.secondary?.resiliencePoints ?? 6,
                stress: c.data?.stressLevel ?? 0,
                insight_dice: c.data?.insightDice ?? 2,
                morality: c.data?.secondary?.morality ?? 3,
                cdp: c.data?.cdp ?? 0,
              }}
              showButtons={true}
              isMySheet={true}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
