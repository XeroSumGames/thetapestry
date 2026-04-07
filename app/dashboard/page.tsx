'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { trackGhostConversion } from '../../lib/events'
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('../../components/MapView'), { ssr: false })

interface Pin {
  id: string
  user_id: string
  title: string
  notes: string
  lat: number
  lng: number
  status: string
  pin_type: string
  created_at: string
  profiles?: { username: string }
  attachments?: string[]
}

export default function DashboardPage() {
  const [username, setUsername] = useState('')
  const [userRole, setUserRole] = useState<'survivor' | 'thriver'>('survivor')
  const [loading, setLoading] = useState(true)
  const [pendingPins, setPendingPins] = useState<Pin[]>([])
  const [acting, setActing] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      trackGhostConversion()
      const { data: profile } = await supabase.from('profiles').select('username, role, onboarded').eq('id', user.id).single()
       if (profile) {
        if (!profile.onboarded) { router.push('/welcome'); return }
        setUsername(profile.username)
        setUserRole((profile.role as string).toLowerCase() as 'survivor' | 'thriver')
        if (profile.role === 'thriver') {
          const { data: rawRumors } = await supabase
            .from('map_pins')
            .select('*, profiles!map_pins_user_id_fkey(username)')
            .eq('pin_type', 'rumor')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

          const rumors = await Promise.all((rawRumors ?? []).map(async (pin: any) => {
            const { data: files } = await supabase.storage
              .from('pin-attachments')
              .list(`${pin.user_id}/${pin.id}`)
            return { ...pin, attachments: files?.map((f: any) => f.name) ?? [] }
          }))
          setPendingPins(rumors)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleAction(id: string, action: 'approved' | 'rejected') {
    setActing(id)
    await supabase.from('map_pins').update({ status: action }).eq('id', id)
    setPendingPins(prev => prev.filter(p => p.id !== id))
    setActing(null)
  }


  if (loading) return (
    <div style={{ flex: 1, background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif' }}>
      Loading...
    </div>
  )

  // Ghost landing — unauthenticated visitors
  if (!username) return (
    <div style={{ flex: 1, background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <img src="/distemper-dogsign-logo.png" alt="Distemper" style={{ width: '180px', objectFit: 'contain', marginBottom: '1.5rem' }} />
      <img src="/DistemperLogoRedv5.png" alt="Distemper" style={{ height: '32px', objectFit: 'contain', marginBottom: '8px' }} />
      <div style={{ fontFamily: 'Distemper, sans-serif', fontSize: '36px', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px' }}>The Tapestry</div>
      <div style={{ fontSize: '15px', color: '#cce0f5', maxWidth: '500px', lineHeight: 1.8, marginBottom: '2rem' }}>
        The online home of Distemper — a post-apocalyptic tabletop RPG. Create characters, explore the world, and play at The Table.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '240px' }}>
        <a href="/map" style={{ padding: '10px 24px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center' }}>Explore The World</a>
        <a href="/signup" style={{ padding: '10px 24px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center' }}>Create Account</a>
        <a href="/login" style={{ padding: '10px 24px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none', textAlign: 'center' }}>Sign In</a>
      </div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* Center — map */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <MapView embedded showSidebar />
      </div>


    </div>
  )
}