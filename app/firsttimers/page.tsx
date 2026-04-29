'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase-browser'
import { getCachedAuth } from '../../lib/auth-cache'
import { trackGhostConversion } from '../../lib/events'

export default function FirstTimersPage() {
  const router = useRouter()
  const supabase = createClient()
  const [username, setUsername] = useState('')
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      trackGhostConversion()
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('username, onboarded').eq('id', user.id).single()
      if (profileErr) {
        console.error('[FirstTimers] profile load error:', profileErr.message)
        setError(`Could not load your profile: ${profileErr.message}`)
        return
      }
      if (!profile) {
        console.error('[FirstTimers] no profile found for user:', user.id)
        setError('Your profile was not created. Please contact support.')
        return
      }
      if (profile.onboarded) { router.push('/dashboard'); return }
      setUsername(profile.username)
    }
    load()
  }, [])

  async function handleGetStarted() {
    setMarking(true)
    const { user } = await getCachedAuth()
    if (user) await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id)
    router.push('/dashboard')
  }

  const sectionTitle: React.CSSProperties = {
    fontFamily: 'Barlow Condensed, sans-serif',
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
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', overflowY: 'auto' }}>

      {error && (
        <div style={{ maxWidth: '500px', margin: '2rem auto', padding: '12px 16px', background: '#2a1210', border: '1px solid #7a1f16', borderRadius: '3px', fontSize: '14px', color: '#f5a89a', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 1rem 2rem', textAlign: 'center' }}>
        <img src="/distemper-dogsign-logo.png" alt="Distemper" style={{ width: '220px', height: '220px', objectFit: 'contain', marginBottom: '2rem' }} />
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>
          Welcome to
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '52px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, marginBottom: '8px' }}>
          The Tapestry
        </div>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#cce0f5', marginBottom: '1.5rem' }}>
          DistemperVerse v1.0
        </div>
        {username && (
          <div style={{ fontSize: '16px', color: '#d4cfc9', marginBottom: '2rem' }}>
            Good luck, <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{username}</span>. You&apos;re gonna need it.
          </div>
        )}
        <div style={{ fontSize: '17px', color: '#f5f2ee', maxWidth: '600px', lineHeight: 1.8 }}>
          <p style={{ marginBottom: '1rem' }}>The Tapestry is the online home of Distemper, a post-apocalyptic comic book &amp; tabletop RPG that take place in the aftermath of the dog flu, a pandemic that wiped out almost 90% of mankind in less than a year. What is left is a dangerous, brutal, and capricious new reality where only the strong survive. There are no zombies, mutants, or aliens - just other, desparate survivors.</p>
          <p style={{ marginBottom: '1rem' }}>The Tapestry is a one-stop shop with tools for character creation, world building, writing and playing story, as well as finding your people in this broken new world.</p>
          <p style={{ marginBottom: '1rem' }}>Here, players and Game Masters share their stories, settings, and storys, allowing them to be curated and shared with the community &mdash; potentially even being worked into future comic book story arcs or game content.</p>
          <p style={{ marginBottom: '1rem' }}>The Tapestry lets the actions of player characters, Game Masters, writers, content creators, and other community members influence the course of human history and define ongoing events in this new world.</p>
          <p>Collectively, the narratives weaved together across various media and via disparate platforms make up The Tapestry of The DistemperVerse.</p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: '60px', height: '2px', background: '#c0392b', margin: '0 auto 3rem' }} />

      {/* Feature sections */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 1.5rem' }}>

        <div style={sectionWrap}>
          <div style={emoji}>🧬</div>
          <div>
            <div style={sectionTitle}>Create Your Survivor</div>
            <div style={sectionBody}>
              <p style={{ marginBottom: '0.75rem' }}>Build your character using either the Backstory Generation system. Here you will spend Character Development Points (CDP) through the chapters of your character&apos;s life as you define where they grew up, what they learned, how they made their way in the world before. and what they have learned in the world after.</p>
              <p>Experienced players can used the Quick Character Generator to spend 20 CDP to customize their character.</p>
              <p>Every character has a story before the story begins. Here is where you write yours.</p>
            </div>
          </div>
        </div>

        <div style={sectionWrap}>
          <div style={emoji}>🗺️</div>
          <div>
            <div style={sectionTitle}>The World Map</div>
            <div style={sectionBody}>
              <p style={{ marginBottom: '0.75rem' }}>This interactive maps is the backbone of the living, breathing Tapestry of the DistemperVerse. Players and GMs can drop pins to mark locations, leave notes, and submit Rumors for others to substantiate.</p>
              <p>It is here that groups can write the story of this dark new world and potentially shape the history yet to come.</p>
            </div>
          </div>
        </div>

        <div style={sectionWrap}>
          <div style={emoji}>🔥</div>
          <div>
            <div style={sectionTitle}>The Campfire</div>
            <div style={sectionBody}>
              <p style={{ marginBottom: '0.75rem' }}>The Campfire is the post-apocalyptic equivalent of the town notice board &mdash; the place survivors gather to share what they&apos;ve heard, warn others about dangers, and find people to travel with. Here you will find:</p>
              <ul style={{ paddingLeft: '1.2rem', margin: '0 0 0.75rem', lineHeight: 2 }}>
                <li>Tools to let you communicate with other players, as well as Looking for Group posts &mdash; players looking for a game or a GM looking for players</li>
                <li>New Rumors from the map &mdash; when survivors mark things on the map, further details appear in The Campfire</li>
                <li>War Stories &mdash; those wanting to write up summaries or fiction about what happened to them or their group have a spot here to share them</li>
                <li>World events &mdash; updates that affect the world or new content from the publisher</li>
              </ul>
            </div>
          </div>
        </div>

        <div style={sectionWrap}>
          <div style={emoji}>🎲</div>
          <div>
            <div style={sectionTitle}>Play at The Table</div>
            <div style={sectionBody}>
              <p style={{ marginBottom: '0.75rem' }}>Coming soon &mdash; The Story Table is The Tapestry&apos;s purpose-built virtual tabletop for Distemper.</p>
              <p>This is a one-stop shop to run sessions, share artifacts, custom maps, roll dice using your character sheet, and track your characters in real time.</p>
            </div>
          </div>
        </div>

        {/* Links */}
        <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '2rem', marginBottom: '2rem', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="https://www.distemperverse.com" target="_blank" rel="noreferrer"
            style={{ padding: '8px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            DistemperVerse.com 🔗
          </a>
          <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer"
            style={{ padding: '8px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            XeroSumGames.com 🔗
          </a>
          <a href="https://www.xerosumstudio.com" target="_blank" rel="noreferrer"
            style={{ padding: '8px 18px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
            XeroSumStudio.com 🔗
          </a>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', paddingBottom: '4rem' }}>
          <button onClick={handleGetStarted} disabled={marking}
            style={{ padding: '14px 48px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', opacity: marking ? 0.6 : 1 }}>
            {marking ? 'Loading...' : 'Welcome to the DistemperVerse'}
          </button>
        </div>

      </div>
    </div>
  )
}
