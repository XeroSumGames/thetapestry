'use client'
import { useEffect } from 'react'
import { createClient } from '../lib/supabase-browser'

// First-visit welcome popup. Shown on /dashboard when
// profiles.onboarded = false; any dismissal (CTA, X, backdrop, ESC)
// flips onboarded = true so the modal doesn't reappear.
//
// Replaces the previous /firsttimers redirect, which was disabled
// during playtest #12 because it trapped new users — they couldn't
// navigate away. /firsttimers stays as a static reference page (the
// sidebar's "A Guide to the Tapestry" link points at /welcome, which
// is also where this modal mirrors the content from).
//
// Content mirrors /firsttimers/page.tsx — kept duplicated rather than
// extracted into a shared component because the surfaces will likely
// diverge over time (modal-friendly trims vs. full-page treatment).

interface Props {
  username: string
  onClose: () => void
}

export default function WelcomeModal({ username, onClose }: Props) {
  const supabase = createClient()

  // Mark onboarded once on dismiss, regardless of which path the user
  // took. Fire-and-forget — we don't want to block the close.
  function dismiss() {
    void (async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        await supabase.from('profiles').update({ onboarded: true }).eq('id', data.user.id)
      }
    })()
    onClose()
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sectionTitle: React.CSSProperties = {
    fontFamily: 'Carlito, sans-serif',
    fontSize: '20px', fontWeight: 700, letterSpacing: '.06em',
    textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px',
  }
  const sectionBody: React.CSSProperties = {
    fontSize: '15px', color: '#f5f2ee', lineHeight: 1.7,
  }
  const sectionWrap: React.CSSProperties = {
    display: 'flex', gap: '1.25rem', marginBottom: '2rem', alignItems: 'flex-start',
  }
  const emoji: React.CSSProperties = {
    fontSize: '28px', flexShrink: 0, marginTop: '2px',
  }

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1rem',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%', maxWidth: '720px', maxHeight: '90vh',
          background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '6px',
          overflowY: 'auto',
          fontFamily: 'Barlow, sans-serif', color: '#f5f2ee',
        }}>

        {/* Close X — top-right, sticky so it's reachable on long scroll. */}
        <button
          onClick={dismiss}
          aria-label="Close"
          style={{
            position: 'sticky', top: '12px', float: 'right',
            marginRight: '12px', marginTop: '12px',
            width: '32px', height: '32px',
            background: 'rgba(20, 20, 20, 0.9)', border: '1px solid #3a3a3a',
            borderRadius: '50%', color: '#cce0f5', fontSize: '15px',
            fontFamily: 'Carlito, sans-serif', cursor: 'pointer', zIndex: 1,
          }}>
          ✕
        </button>

        {/* Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 1.5rem 1.5rem', textAlign: 'center' }}>
          <img src="/distemper-dogsign-logo.png" alt="Distemper" style={{ width: '160px', height: '160px', objectFit: 'contain', marginBottom: '1.25rem' }} />
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '8px' }}>
            Welcome to
          </div>
          <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '46px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, marginBottom: '8px' }}>
            The Tapestry
          </div>
          <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '13px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#cce0f5', marginBottom: '1.25rem' }}>
            DistemperVerse v1.0
          </div>
          {username && (
            <div style={{ fontSize: '15px', color: '#d4cfc9', marginBottom: '1.5rem' }}>
              Good luck, <span style={{ color: '#f5f2ee', fontWeight: 600 }}>{username}</span>. You&apos;re gonna need it.
            </div>
          )}
          <div style={{ fontSize: '15px', color: '#f5f2ee', maxWidth: '560px', lineHeight: 1.7 }}>
            <p style={{ marginBottom: '0.85rem' }}>The Tapestry is the online home of Distemper, a post-apocalyptic comic book &amp; tabletop RPG that take place in the aftermath of the dog flu, a pandemic that wiped out almost 90% of mankind in less than a year. What is left is a dangerous, brutal, and capricious new reality where only the strong survive. There are no zombies, mutants, or aliens — just other, desperate survivors.</p>
            <p style={{ marginBottom: '0.85rem' }}>The Tapestry is a one-stop shop with tools for character creation, world building, writing and playing story, as well as finding your people in this broken new world.</p>
            <p>Collectively, the narratives weaved together across various media and via disparate platforms make up The Tapestry of The DistemperVerse.</p>
          </div>
        </div>

        <div style={{ width: '60px', height: '2px', background: '#c0392b', margin: '0 auto 2rem' }} />

        <div style={{ padding: '0 1.75rem' }}>

          <div style={sectionWrap}>
            <div style={emoji}>🧬</div>
            <div>
              <div style={sectionTitle}>Create Your Survivor</div>
              <div style={sectionBody}>
                <p style={{ marginBottom: '0.6rem' }}>Build a character through Backstory Generation — spend Character Development Points across the chapters of their life, defining where they grew up, what they learned, and how they made their way before and after.</p>
                <p>Experienced players can use the Quick Character Generator to spend 20 CDP and customize directly. Every character has a story before the story begins; here is where you write yours.</p>
              </div>
            </div>
          </div>

          <div style={sectionWrap}>
            <div style={emoji}>🗺️</div>
            <div>
              <div style={sectionTitle}>The World Map</div>
              <div style={sectionBody}>
                <p style={{ marginBottom: '0.6rem' }}>The interactive map is the backbone of the living, breathing Tapestry. Players and GMs drop pins to mark locations, leave notes, and submit Rumors for others to substantiate.</p>
                <p>It is here that groups can write the story of this dark new world and shape the history yet to come.</p>
              </div>
            </div>
          </div>

          <div style={sectionWrap}>
            <div style={emoji}>🔥</div>
            <div>
              <div style={sectionTitle}>The Campfire</div>
              <div style={sectionBody}>
                <p style={{ marginBottom: '0.6rem' }}>The Campfire is the post-apocalyptic equivalent of the town notice board — where survivors gather to share what they&apos;ve heard, warn others, and find people to travel with. Inside you&apos;ll find:</p>
                <ul style={{ paddingLeft: '1.2rem', margin: '0', lineHeight: 1.9 }}>
                  <li>Looking for Group — players seeking a game, GMs seeking players</li>
                  <li>Rumors from the map — pins surface here with extra detail</li>
                  <li>War Stories — write-ups and fiction from sessions past</li>
                  <li>World events — updates from the publisher and the world itself</li>
                </ul>
              </div>
            </div>
          </div>

          <div style={sectionWrap}>
            <div style={emoji}>🎲</div>
            <div>
              <div style={sectionTitle}>Play at The Table</div>
              <div style={sectionBody}>
                <p style={{ marginBottom: '0.6rem' }}>The Story Table is The Tapestry&apos;s purpose-built virtual tabletop for Distemper.</p>
                <p>Run sessions, share artifacts and custom maps, roll dice through your character sheet, and track the party in real time.</p>
              </div>
            </div>
          </div>

          {/* External links */}
          <div style={{ borderTop: '1px solid #2e2e2e', paddingTop: '1.5rem', marginBottom: '1.5rem', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="https://www.distemperverse.com" target="_blank" rel="noreferrer"
              style={{ padding: '7px 16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
              DistemperVerse.com 🔗
            </a>
            <a href="https://www.xerosumgames.com" target="_blank" rel="noreferrer"
              style={{ padding: '7px 16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
              XeroSumGames.com 🔗
            </a>
            <a href="https://www.xerosumstudio.com" target="_blank" rel="noreferrer"
              style={{ padding: '7px 16px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', textDecoration: 'none' }}>
              XeroSumStudio.com 🔗
            </a>
          </div>

          {/* CTA — same dismiss path as backdrop / X / ESC. */}
          <div style={{ textAlign: 'center', paddingBottom: '2rem' }}>
            <button onClick={dismiss}
              style={{ padding: '12px 36px', background: '#c0392b', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '15px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
              Welcome to the DistemperVerse
            </button>
            <div style={{ marginTop: '0.85rem', fontSize: '13px', color: '#5a5a5a' }}>
              You can re-open this any time at <span style={{ color: '#cce0f5' }}>A Guide to the Tapestry</span> in the sidebar.
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
