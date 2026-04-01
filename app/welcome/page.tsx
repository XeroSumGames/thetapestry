'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase-browser'

export default function WelcomePage() {
  const router = useRouter()
  const supabase = createClient()
  const [username, setUsername] = useState('')
  const [marking, setMarking] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('username, onboarded').eq('id', user.id).single()
      if (!profile) return
      if (profile?.onboarded === true) { router.push('/dashboard'); return }
      setUsername(profile.username)
    }
    load()
  }, [])

  async function handleGetStarted() {
    setMarking(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id)
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', overflowY: 'auto' }}>

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 1rem 2rem', textAlign: 'center' }}>
        <img src="/distemper-logo.png" alt="Distemper" style={{ width: '220px', height: '220px', objectFit: 'contain', marginBottom: '2rem' }} />
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>
          Welcome to
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '52px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, marginBottom: '8px' }}>
          The Tapestry
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#5a5550', marginBottom: '1.5rem' }}>
          DistemperVerse v1.0
        </div>
        {username && (
          <div style={{ fontSize: '16px', color: '#b0aaa4', marginBottom: '2rem' }}>
            Good luck, <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{username}</span>. You're gonne need it.
          </div>
        )}
        <div style={{ fontSize: '15px', color: '#b0aaa4', maxWidth: '540px', lineHeight: 1.8 }}>
          The Tapestry is the online home of Distemper — a post-apocalyptic tabletop RPG set in a world that has gone to the dogs. This is your one-stop shop for character creation, world exploration, and finding your people in the wasteland.
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '60px', height: '2px', background: '#c0392b', margin: '0 auto 3rem' }} />

      {/* Feature sections */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 1.5rem' }}>

        {[
          {
            emoji: '🧬',
            title: 'Create Your Survivor',
            body: 'Build your character using the Xero Sum Engine backstory system. Spend Character Development Points across the chapters of your life — where you grew up, what you learned, how you make your way in the wasteland. Every character has a story before the story begins.',
          },
          {
            emoji: '🗺️',
            title: 'The World Map',
            body: 'The Tapestry\'s world map is a living, breathing record of the DistemperVerse. Drop pins to mark locations, leave notes, and submit Rumors for Thriving members to review. Approved Rumors become part of the shared world — discoverable by every group playing in it.',
          },
          {
            emoji: '👤',
            title: 'Survivors & Thrivers',
            body: 'Every player starts as a Survivor. Thrivers are trusted members of the community who moderate the world map, approve Rumors, and help keep the DistemperVerse consistent and compelling. Earn your place among them.',
          },
          {
            emoji: '🎲',
            title: 'Play at The Table',
            body: 'Coming soon — The Table is The Tapestry\'s purpose-built virtual tabletop for Distemper. Run sessions, roll dice using full XSE game logic, track your characters in real time, and let your session\'s events ripple out into the persistent world.',
          },
        ].map(({ emoji, title, body }) => (
          <div key={title} style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.5rem', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '32px', flexShrink: 0, marginTop: '2px' }}>{emoji}</div>
            <div>
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '20px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
                {title}
              </div>
              <div style={{ fontSize: '14px', color: '#b0aaa4', lineHeight: 1.8 }}>
                {body}
              </div>
            </div>
          </div>
        ))}

        {/* Links */}
        <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '2rem', marginBottom: '2rem', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a href="https://www.distemperverse.com" target="_blank" rel="noreferrer"
            style={{ padding: '8px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b0aaa4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            DistemperVerse.com ↗
          </a>
          <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer"
            style={{ padding: '8px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#b0aaa4', fontSize: '12px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            XeroSumGames.com ↗
          </a>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', paddingBottom: '4rem' }}>
          <button onClick={handleGetStarted} disabled={marking}
            style={{ padding: '14px 48px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', opacity: marking ? 0.6 : 1 }}>
            {marking ? 'Loading...' : 'Enter the Wasteland'}
          </button>
        </div>

      </div>
    </div>
  )
}