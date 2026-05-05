'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../../../lib/supabase-browser'
import { getCachedAuth } from '../../../../../lib/auth-cache'
import { useRouter, useParams } from 'next/navigation'
import CharacterCard from '../../../../../components/CharacterCard'

interface CharacterRow {
  id: string
  name: string
  created_at: string
  data: any
}

export default function UserCharactersPage() {
  const params = useParams()
  const userId = params.userId as string
  const router = useRouter()
  const supabase = createClient()
  const [characters, setCharacters] = useState<CharacterRow[]>([])
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [joinDate, setJoinDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingAll, setDeletingAll] = useState(false)

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }

      const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (myProfile?.role?.toLowerCase() !== 'thriver') { router.push('/dashboard'); return }

      const { data: profile } = await supabase.from('profiles').select('username, email, created_at').eq('id', userId).single()
      setUsername(profile?.username ?? 'Unknown')
      setEmail(profile?.email ?? '')
      setJoinDate(profile?.created_at ?? '')

      const { data } = await supabase
        .from('characters')
        .select('id, name, created_at, data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      setCharacters(data ?? [])
      setLoading(false)
    }
    load()
  }, [userId])

  async function handleDelete(id: string) {
    // Error-check + bail before flipping state. The pre-fix optimistic
    // filter ran regardless of outcome, so an RLS denial or network
    // blip left the row gone from the moderator UI but still present
    // on the server until reload. Mirrors the user-side fix that
    // already shipped on /characters.
    const { error } = await supabase.from('characters').delete().eq('id', id)
    if (error) {
      alert(`Delete failed: ${error.message}`)
      return
    }
    setCharacters(prev => prev.filter(c => c.id !== id))
  }

  async function handleDeleteAll() {
    if (!confirm(`Delete all ${characters.length} characters for ${username}? This cannot be undone.`)) return
    setDeletingAll(true)
    const { error } = await supabase.from('characters').delete().eq('user_id', userId)
    setDeletingAll(false)
    if (error) {
      alert(`Bulk delete failed: ${error.message}`)
      return
    }
    setCharacters([])
  }

  if (loading) return (
    <div style={{ padding: '2rem', color: '#cce0f5', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
  )

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', marginBottom: '1.5rem' }}>
        <Link href="/moderate" style={{ padding: '5px 12px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', marginTop: '4px' }}>
          Back
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '22px', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#f5f2ee' }}>
            {username}&apos;s Characters
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5', marginBottom: '2px' }}>
            {email}{joinDate && <> &middot; Joined {new Date(joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>}
          </div>
          <div style={{ fontSize: '13px', color: '#cce0f5' }}>
            {characters.length} character{characters.length !== 1 ? 's' : ''}
          </div>
        </div>
        {characters.length > 0 && (
          <button onClick={handleDeleteAll} disabled={deletingAll}
            style={{ padding: '5px 12px', background: 'none', border: '1px solid #7a1f16', borderRadius: '3px', color: '#f5a89a', fontSize: '13px', cursor: 'pointer', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', marginTop: '4px', opacity: deletingAll ? 0.5 : 1 }}>
            {deletingAll ? 'Deleting...' : 'Delete All Characters'}
          </button>
        )}
      </div>

      {characters.length === 0 ? (
        <div style={{ color: '#cce0f5', fontSize: '14px' }}>No characters found.</div>
      ) : (
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
              canEdit={false}
              isMySheet={false}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
