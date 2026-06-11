'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { trackGhostConversion } from '../../lib/events'
import { ONBOARDING_SECTIONS } from '../../lib/onboarding-sections'

export default function FirstTimersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [username, setUsername] = useState('')
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // /firsttimers used to redirect to /dashboard once profiles.onboarded
    // was true, trapping users on a one-shot intro. Now /firsttimers is a
    // re-readable reference page; the first-visit welcome lives in
    // <WelcomeModal /> on /dashboard. Logged-out visitors can still see
    // the page (the DistemperVerse pitch is fine as a public read).
    async function load() {
      const { user } = await getCachedAuth()
      if (user) {
        trackGhostConversion()
        const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single()
        if (profile) setUsername(profile.username)
      }
    }
    load()
  }, [])

  async function handleGetStarted() {
    // Idempotent - flips onboarded=true if it isn't already, then
    // sends the user back to the dashboard. Same end state as the
    // modal's CTA so re-readers don't get stuck on the intro.
    setMarking(true)
    const { user } = await getCachedAuth()
    if (user) await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id)
    router.push('/dashboard')
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: 'Carlito, sans-serif',
    fontSize: '20px', fontWeight: 700, letterSpacing: '.06em',
    textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px',
  }
  const sectionBody: React.CSSProperties = {
    fontSize: '16px', color: '#f5f2ee', lineHeight: 1.8,
  }
  const sectionWrap: React.CSSProperties = {
    display: 'flex', gap: '1.5rem', marginBottom: '2.5rem', alignItems: 'flex-start',
  }
  const emoji: React.CSSProperties = {
    fontSize: '32px', flexShrink: 0, marginTop: '2px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', overflowY: 'auto' }}>

      {error && (
        <div style={{ maxWidth: '500px', margin: '2rem auto', padding: '12px 16px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', fontSize: '14px', color: '#f5a89a', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 1rem 2rem', textAlign: 'center' }}>
        <img src="/distemper-dogsign-logo.png" alt="Distemper" style={{ width: '220px', height: '220px', objectFit: 'contain', marginBottom: '2rem' }} />
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>
          Welcome to
        </div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '52px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, marginBottom: '8px' }}>
          The Tapestry
        </div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '14px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#cce0f5', marginBottom: '1.5rem' }}>
          DistemperVerse v1.0
        </div>
        {username && (
          <div style={{ fontSize: '16px', color: '#d4cfc9', marginBottom: '2rem' }}>
            Good luck, <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{username}</span>. You&apos;re gonna need it.
          </div>
        )}
        <div style={{ fontSize: '17px', color: '#f5f2ee', maxWidth: '600px', lineHeight: 1.8 }}>
          <p style={{ marginBottom: '1rem' }}>The Tapestry is the online home of Distemper, a post-apocalyptic comic book &amp; tabletop RPG set in the aftermath of the dog flu - a pandemic that wiped out almost 90% of mankind in less than a year. What is left is a dangerous, brutal, and capricious new reality where only the strong survive. There are no zombies, mutants, or aliens - just other, desperate survivors.</p>
          <p style={{ marginBottom: '1rem' }}>The Tapestry is a one-stop shop with tools for character creation, world building, writing and playing story, as well as finding your people in this broken new world.</p>
          <p style={{ marginBottom: '1rem' }}>Here, players and Game Masters share their stories, settings, and sessions, allowing them to be curated and shared with the community - potentially even being worked into future comic book story arcs or game content.</p>
          <p>Collectively, the narratives weaved together across various media and via disparate platforms make up The Tapestry of The DistemperVerse.</p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '60px', height: '2px', background: '#c0392b', margin: '0 auto 3rem' }} />

      {/* Feature sections */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 1.5rem' }}>

        {ONBOARDING_SECTIONS.map(s => (
          <div key={s.title} style={sectionWrap}>
            <div style={emoji}>{s.emoji}</div>
            <div>
              <div style={sectionTitle}>{s.title}</div>
              <div style={sectionBody}>
                {s.body.map((p, i) => (
                  <p key={i} style={i < s.body.length - 1 || s.list ? { marginBottom: '0.75rem' } : {}}>{p}</p>
                ))}
                {s.list && (
                  <ul style={{ paddingLeft: '1.2rem', margin: '0 0 0.75rem', lineHeight: 2 }}>
                    {s.list.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Links */}
        <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '2rem', marginBottom: '2rem', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="https://www.distemperverse.com" target="_blank" rel="noreferrer"
            style={{ padding: '8px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            DistemperVerse.com 🔗
          </a>
          <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer"
            style={{ padding: '8px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            XeroSumGames.com 🔗
          </a>
          <a href="https://www.xerosumstudio.com" target="_blank" rel="noreferrer"
            style={{ padding: '8px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            XeroSumStudio.com 🔗
          </a>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', paddingBottom: '4rem' }}>
          <button onClick={handleGetStarted} disabled={marking}
            style={{ padding: '14px 48px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '16px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', opacity: marking ? 0.6 : 1 }}>
            {marking ? 'Loading...' : 'Welcome to the DistemperVerse'}
          </button>
        </div>

      </div>
    </div>
  )
}
