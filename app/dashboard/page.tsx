'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { isThriver as roleIsThriver } from '../../lib/auth/roles'
import { useRouter, useSearchParams } from 'next/navigation'
import { trackGhostConversion } from '../../lib/events'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import WelcomeModal from '../../components/WelcomeModal'
import { countGmCampaigns } from '../../lib/data/campaigns'

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
  const [loading, setLoading] = useState(true)
  const [pendingPins, setPendingPins] = useState<Pin[]>([])
  const [acting, setActing] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showWelcome, setShowWelcome] = useState(false)
  const [hasCampaigns, setHasCampaigns] = useState(true)
  const [skipToWorld, setSkipToWorld] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const searchParams = useSearchParams()

  // "A Guide to the Tapestry" (sidebar) links here with ?tour=1 so the replayable
  // tour runs over the LIVE dashboard - its per-step arrows point at real sidebar
  // elements, so it must sit on top of the actual page, not /welcome's static
  // reference cards. Reactive to the param (not just mount) so clicking the link
  // while already on /dashboard still opens it.
  const tourRequested = searchParams.get('tour') === '1'
  useEffect(() => {
    if (tourRequested) setShowWelcome(true)
  }, [tourRequested])

  // Closing the tour clears the ?tour=1 param so a refresh doesn't reopen it.
  // (The first-login auto-open path has no param, so this is a no-op there.)
  function closeWelcome() {
    setShowWelcome(false)
    if (tourRequested) router.replace('/dashboard', { scroll: false })
  }

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { setLoading(false); return }
      trackGhostConversion()
      const { data: profile } = await supabase.from('profiles').select('username, role, onboarded').eq('id', user.id).single()
       if (profile) {
        // First-visit welcome - the stepped tour modal, shown once when
        // onboarded=false; any dismiss flips onboarded=true so it doesn't
        // reappear. The same tour is replayable ungated via ?tour=1 (the
        // sidebar "A Guide to the Tapestry" link). (The old /firsttimers forced
        // gate that trapped new users in playtest #12 has been deleted, and the
        // /welcome reference page it linked has now been retired too.)
        if (!profile.onboarded) setShowWelcome(true)
        setUsername(profile.username)
        const { count } = await countGmCampaigns(user.id)
        setHasCampaigns((count ?? 0) > 0)
        if (roleIsThriver(profile)) {
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

  // Ghost landing - show the map directly, ghost wall triggers on interaction.
  // Still honor ?tour=1 so the sidebar "A Guide to the Tapestry" link opens the
  // tour for logged-out visitors too (step 1 is the pitch - good for conversion).
  if (!username) return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <MapView embedded showSidebar />
      {showWelcome && <WelcomeModal username={username} onClose={closeWelcome} />}
    </div>
  )

  // New-but-authed: logged-in, onboarded, no campaigns yet. Show the first-action
  // pull instead of the world map so a new GM lands on something actionable.
  // WelcomeModal still renders on top when !onboarded (brand-new users see both).
  if (!hasCampaigns && skipToWorld) return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <MapView embedded showSidebar />
      </div>
      {showWelcome && <WelcomeModal username={username} onClose={closeWelcome} />}
    </div>
  )

  if (!hasCampaigns) return (
    <div style={{ flex: 1, background: '#0f0f0f', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '2rem 1rem', fontFamily: 'Carlito, sans-serif' }}>
      <div style={{ maxWidth: '680px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '36px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1.1, marginBottom: '10px' }}>
            Your Story Starts Here
          </div>
          <div style={{ fontSize: '16px', color: '#cce0f5', lineHeight: 1.6 }}>
            Create your first story or run a free module - get to the table in under two minutes.
          </div>
        </div>

        {/* Primary CTA */}
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <Link href="/stories/new" style={{ display: 'inline-block', padding: '14px 48px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '16px', letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none' }}>
            Create Your First Story
          </Link>
        </div>

        {/* Join CTA - the cold-signup who came to play in a friend's game, not
            GM their own. Without this they bounce (no obvious "where do I put
            my invite code"). */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', fontSize: '14px', color: '#8a8a8a' }}>
          Got an invite code from your GM?{' '}
          <Link href="/stories/join" style={{ color: '#7ab3d4', textDecoration: 'none', letterSpacing: '.04em', textTransform: 'uppercase', fontSize: '13px', fontWeight: 700 }}>
            Join a Story
          </Link>
        </div>

        {/* Free modules */}
        <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '2rem' }}>
          <div style={{ fontSize: '13px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#7a7a7a', textAlign: 'center', marginBottom: '1.25rem' }}>
            Or run a free module
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {([
              { name: 'Empty', tagline: 'Blank sandbox - build your own world', badge: 'Tutorial' },
              { name: 'The Basement', tagline: 'A grim starter dungeon for new GMs', badge: 'Free' },
              { name: 'The Arena', tagline: "Denver's deadly gladiatorial circuit", badge: 'Free' },
            ] as const).map(m => (
              <Link key={m.name} href="/stories/new" style={{ display: 'block', padding: '1rem', background: '#161616', border: '1px solid #2e2e2e', borderRadius: '4px', textDecoration: 'none', transition: 'border-color 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#f5f2ee' }}>{m.name}</div>
                  <div style={{ fontSize: '13px', padding: '1px 6px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '2px', color: '#7fc458', letterSpacing: '.06em' }}>{m.badge}</div>
                </div>
                <div style={{ fontSize: '13px', color: '#8a8a8a', lineHeight: 1.5 }}>{m.tagline}</div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '13px', color: '#5a5a5a' }}>
            All three modules are available in the module picker on the next screen.
          </div>
        </div>

        {/* Escape hatch for explorers who just want to look around */}
        <div style={{ textAlign: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #1e1e1e' }}>
          <button
            onClick={() => setSkipToWorld(true)}
            style={{ background: 'transparent', border: 'none', color: '#5a5a5a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'underline' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#cce0f5')}
            onMouseLeave={e => (e.currentTarget.style.color = '#5a5a5a')}>
            Take me to the world
          </button>
        </div>
      </div>

      {showWelcome && (
        <WelcomeModal username={username} onClose={closeWelcome} />
      )}
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* Center - map */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <MapView embedded showSidebar />
      </div>

      {showWelcome && (
        <WelcomeModal username={username} onClose={closeWelcome} />
      )}

    </div>
  )
}