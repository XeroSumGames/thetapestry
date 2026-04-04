'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import CharacterCard from '../../components/CharacterCard'

interface CharacterRow {
  id: string
  name: string
  created_at: string
  data: any
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
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
    await supabase.from('characters').delete().eq('id', id)
    setCharacters(prev => prev.filter(c => c.id !== id))
  }

  async function handleDuplicate(c: CharacterRow) {
    const { data: { user } } = await supabase.auth.getUser()
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
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
          My Survivors
        </div>
        <div style={{ flex: 1 }} />
        <a href='/characters/new' style={{ padding: '7px 18px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
          New Character
        </a>
      </div>

      {characters.length === 0 && (
        <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: '#d4cfc9', marginBottom: '1rem' }}>No characters yet.</div>
          <a href='/characters/new' style={{ padding: '9px 22px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Create your first character
          </a>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {characters.map(c => (
          <CharacterCard
  key={c.id}
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
        ))}
      </div>
    </div>
  )
}
