'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase-browser'
import { onboardingSection, type OnboardingSection } from '../lib/onboarding-sections'

// First-visit welcome tour. Shown on /dashboard when profiles.onboarded =
// false; ANY dismissal (Skip, Enter, X, backdrop, ESC) flips onboarded = true
// so it doesn't reappear.
//
// A STEPPED sequence (Next / Back / Skip), not one long scroll. CRITICAL: every
// step must stay skippable/dismissible - the old /firsttimers forced redirect
// was disabled during playtest #12 because it TRAPPED new users who couldn't
// navigate away, so there is no "march through all steps" gate here. Skip and
// the X are always available, and backdrop/ESC always dismiss.
//
// Content comes from lib/onboarding-sections.ts; the welcome pitch (step 1)
// and the video slot (last step) are modal-only. Step order matches Xero's
// 2026-08-04 spec:
// Welcome -> Dashboard -> Your Characters -> Campfire -> Your Pins -> Video.

interface Props {
  username: string
  onClose: () => void
}

type Step =
  | { kind: 'welcome' }
  | { kind: 'section'; section: OnboardingSection; titleOverride?: string }
  | { kind: 'video' }

export default function WelcomeModal({ username, onClose }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState(0)

  // Build the ordered step list, tolerating a missing section (filter keeps the
  // tour intact if the content data ever changes shape).
  const dashboard = onboardingSection('dashboard')
  const characters = onboardingSection('characters')
  const campfire = onboardingSection('campfire')
  const pins = onboardingSection('pins')
  const steps: Step[] = [
    { kind: 'welcome' },
    ...(dashboard ? [{ kind: 'section' as const, section: dashboard }] : []),
    ...(characters ? [{ kind: 'section' as const, section: characters, titleOverride: 'Your Characters' }] : []),
    ...(campfire ? [{ kind: 'section' as const, section: campfire }] : []),
    ...(pins ? [{ kind: 'section' as const, section: pins, titleOverride: 'Your Pins' }] : []),
    { kind: 'video' },
  ]
  const total = steps.length
  const idx = Math.min(step, total - 1)
  const current = steps[idx]
  const isFirst = idx === 0
  const isLast = idx === total - 1

  // Mark onboarded on any dismissal path. Fire-and-forget so the close is instant.
  function dismiss() {
    void (async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) await supabase.from('profiles').update({ onboarded: true }).eq('id', data.user.id)
    })()
    onClose()
  }
  function next() { if (isLast) dismiss(); else setStep(s => Math.min(s + 1, total - 1)) }
  function back() { setStep(s => Math.max(0, s - 1)) }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // Re-bind each step so the arrow handlers close over the latest idx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, total])

  const navBtn = (primary: boolean, disabled = false): React.CSSProperties => ({
    padding: '10px 24px',
    background: disabled ? '#1a1a1a' : primary ? '#c0392b' : '#242424',
    border: `1px solid ${disabled ? '#2a2a2a' : primary ? '#c0392b' : '#3a3a3a'}`,
    borderRadius: '3px',
    color: disabled ? '#5a5a5a' : primary ? '#fff' : '#f5f2ee',
    fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em',
    textTransform: 'uppercase', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

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
          position: 'relative', width: '100%', maxWidth: '640px', maxHeight: '90vh',
          background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '6px',
          fontFamily: 'Carlito, sans-serif', color: '#f5f2ee',
          display: 'flex', flexDirection: 'column',
        }}>

        {/* Header: progress + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
            {steps.map((_, i) => (
              <div key={i}
                onClick={() => setStep(i)}
                title={`Step ${i + 1} of ${total}`}
                style={{ width: i === idx ? '22px' : '9px', height: '9px', borderRadius: '5px', background: i === idx ? '#c0392b' : i < idx ? '#7a1f16' : '#2e2e2e', cursor: 'pointer', transition: 'width .15s, background .15s' }} />
            ))}
          </div>
          <span style={{ fontSize: '13px', color: '#5a5a5a', flexShrink: 0 }}>Step {idx + 1} of {total}</span>
          <button onClick={dismiss} aria-label="Close"
            style={{ width: '28px', height: '28px', background: 'rgba(20,20,20,0.9)', border: '1px solid #3a3a3a', borderRadius: '50%', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: 0 }}>✕</button>
        </div>

        {/* Content (scrolls; nav stays pinned) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
          {current.kind === 'welcome' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <img src="/distemper-dogsign-logo.png" alt="Distemper" style={{ width: '128px', height: '128px', objectFit: 'contain', marginBottom: '1rem' }} />
              <div style={{ fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '6px' }}>Welcome to</div>
              <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '42px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, marginBottom: '6px' }}>The Tapestry</div>
              <div style={{ fontSize: '13px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#cce0f5', marginBottom: '1rem' }}>DistemperVerse v1.0</div>
              {username && (
                <div style={{ fontSize: '15px', color: '#f5f2ee', marginBottom: '1.25rem' }}>
                  Good luck, <span style={{ fontWeight: 600 }}>{username}</span>. You&apos;re gonna need it.
                </div>
              )}
              <div style={{ fontSize: '15px', color: '#f5f2ee', maxWidth: '520px', lineHeight: 1.7, textAlign: 'left' }}>
                <p style={{ marginBottom: '0.85rem' }}>The Tapestry is the online home of Distemper, a post-apocalyptic comic book &amp; tabletop RPG set in the aftermath of the dog flu - a pandemic that wiped out almost 90% of mankind in less than a year. What is left is a dangerous, brutal, and capricious new reality where only the strong survive. There are no zombies, mutants, or aliens - just other, desperate survivors.</p>
                <p style={{ marginBottom: '0.85rem' }}>It is a one-stop shop with tools for character creation, world building, writing and playing story, and finding your people in this broken new world.</p>
                <p>The next few screens are a quick tour. You can skip out any time.</p>
              </div>
            </div>
          )}

          {current.kind === 'section' && (
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '40px', flexShrink: 0, marginTop: '2px' }}>{current.section.emoji}</div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '10px' }}>
                  {current.titleOverride ?? current.section.title}
                </div>
                <div style={{ fontSize: '15px', color: '#f5f2ee', lineHeight: 1.7 }}>
                  {current.section.body.map((p, i) => (
                    <p key={i} style={i < current.section.body.length - 1 || current.section.list ? { marginBottom: '0.6rem' } : {}}>{p}</p>
                  ))}
                  {current.section.list && (
                    <ul style={{ paddingLeft: '1.2rem', margin: 0, lineHeight: 1.9 }}>
                      {current.section.list.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {current.kind === 'video' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎬</div>
              <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '14px' }}>Watch This Video</div>
              <div style={{ maxWidth: '520px', margin: '0 auto', aspectRatio: '16 / 9', background: '#141414', border: '1px dashed #3a3a3a', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a5a5a', fontSize: '13px', letterSpacing: '.06em', textAlign: 'center', padding: '1rem' }}>
                A short intro video is on the way. It&apos;ll live right here.
              </div>
              <div style={{ marginTop: '1.25rem', fontSize: '15px', color: '#f5f2ee' }}>That&apos;s the tour. Welcome to the DistemperVerse.</div>
            </div>
          )}
        </div>

        {/* Footer nav - Back / Skip / Next|Enter. Skip + X + backdrop + ESC all
            dismiss at every step; there is intentionally no way to get trapped. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderTop: '1px solid #1e1e1e', flexShrink: 0 }}>
          <button onClick={back} disabled={isFirst} style={navBtn(false, isFirst)}>← Back</button>
          <div style={{ flex: 1 }} />
          {!isLast && (
            <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#8a8a8a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 10px' }}>Skip tour</button>
          )}
          <button onClick={next} style={navBtn(true)}>{isLast ? 'Enter The Tapestry' : 'Next →'}</button>
        </div>
      </div>
    </div>
  )
}
