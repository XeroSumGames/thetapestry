'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { useRouter } from 'next/navigation'
import { trackGhostConversion } from '../../lib/events'
import dynamic from 'next/dynamic'
import WelcomeModal from '../../components/WelcomeModal'

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
  const [showWelcome, setShowWelcome] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { setLoading(false); return }
      trackGhostConversion()
      const { data: profile } = await supabase.from('profiles').select('username, role, onboarded').eq('id', user.id).single()
       if (profile) {
        // First-visit welcome — replaces the trap-the-user `/welcome`
        // redirect that was disabled in playtest #12. Now it's a
        // dismissible modal on the dashboard; any dismiss flips
        // onboarded=true so it doesn't reappear. /firsttimers stays
        // available as a re-readable reference page.
        if (!profile.onboarded) setShowWelcome(true)
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
    <div style={{ flex: 1, background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>
      Loading...
    </div>
  )

  // Ghost landing — show the map directly, ghost wall triggers on interaction
  if (!username) return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <MapView embedded showSidebar />
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* Center — map */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <MapView embedded showSidebar />
      </div>

      {showWelcome && (
        <WelcomeModal username={username} onClose={() => setShowWelcome(false)} />
      )}

    </div>
  )
}