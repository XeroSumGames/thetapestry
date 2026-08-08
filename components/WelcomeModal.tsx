'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase-browser'
import { useDragPosition, type DragPosition } from '../lib/use-drag-position'
import {
  TOUR_STEPS, TOUR_WIDTH, WELCOME_PITCH, VIDEO_HEADING, VIDEO_SUBTITLE, TOUR_VIDEOS,
  tourAnchorSelector,
} from '../lib/onboarding-tour'

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
// ALL step order + text lives in lib/onboarding-tour.ts (the one file to edit).
// This component only renders it. Section steps point an animated arrow + box at
// the app element named by their `anchor` (tagged with data-tour attributes in
// Sidebar.tsx / MapView.tsx); the modal is draggable by its grip; the backdrop is
// a light scrim (not a blackout) so the pointed-at UI stays readable underneath.

interface Props {
  username: string
  onClose: () => void
}

// A step's anchor can match one OR MORE tagged elements (data-tour="a b" puts an
// element in several groups; ~= matches any single word). The modal unions the
// matched rects, so a box can cover a whole block of sidebar links, not just one.
type AnchorBox = { left: number; top: number; right: number; width: number; height: number }

// Tiny inline markup for tour copy: **bold** and *italic*. Content lives in
// lib/onboarding-tour.ts as plain strings - this is the only markup they get.
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

// Auto placement when a step has an anchor but no captured `pos`: nudge the modal
// to the side of the highlighted area so it sits NEAR it (drawing the eye toward
// it) without covering it.
function autoModalPos(box: AnchorBox, vw: number, vh: number): DragPosition {
  const MODAL_W = 640, GAP = 44, MARGIN = 20
  let x = box.left < vw / 2
    ? Math.min(box.right + GAP, vw - MODAL_W - MARGIN)   // anchor on the left -> modal to its right
    : Math.max(MARGIN, box.left - GAP - MODAL_W)          // anchor on the right -> modal to its left
  x = Math.max(MARGIN, x)
  const y = Math.max(MARGIN, Math.min(box.top, vh - 260))
  return { x, y }
}

export default function WelcomeModal({ username, onClose }: Props) {
  const supabase = createClient()
  const [step, setStep] = useState(0)
  const { pos, setPos, onHandleMouseDown } = useDragPosition()
  const [calibrate, setCalibrate] = useState(false)
  useEffect(() => {
    try { setCalibrate(new URLSearchParams(window.location.search).get('cal') === '1') } catch { /* ignore */ }
  }, [])

  // Order + text come straight from the tour config file.
  const steps = TOUR_STEPS
  const total = steps.length
  const idx = Math.min(step, total - 1)
  const current = steps[idx]
  const isFirst = idx === 0
  const isLast = idx === total - 1

  const anchorSel = current.kind === 'section' && current.anchor ? tourAnchorSelector(current.anchor) : undefined
  // Human-readable label for the calibration readout.
  const stepLabel = current.kind === 'section' ? current.title : current.kind
  const stepWidth = current.kind === 'section' && current.width ? current.width : TOUR_WIDTH

  // Measure the anchored sidebar element's live position so the ring + arrow
  // track it (and stay put when the modal is dragged away). Re-measure on step
  // change, resize, and scroll; the delayed pass catches sidebar layout settling.
  const [anchorRect, setAnchorRect] = useState<AnchorBox | null>(null)
  useEffect(() => {
    if (!anchorSel) { setAnchorRect(null); return }
    function measure() {
      const rects = [...document.querySelectorAll(anchorSel!)]
        .map(el => el.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0)
      if (!rects.length) { setAnchorRect(null); return }
      const left = Math.min(...rects.map(r => r.left))
      const top = Math.min(...rects.map(r => r.top))
      const right = Math.max(...rects.map(r => r.right))
      const bottom = Math.max(...rects.map(r => r.bottom))
      setAnchorRect({ left, top, right, width: right - left, height: bottom - top })
    }
    measure()
    const t = setTimeout(measure, 80)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [anchorSel, idx])

  // Move the modal toward each step's area, ONCE per step (keyed on idx only, so
  // scroll/resize re-measuring the ring doesn't yank the modal). A captured
  // position wins; else auto-place beside the anchor; else center (welcome/video).
  // Manual dragging overrides until the next step change.
  useEffect(() => {
    const captured = current.kind === 'section' ? current.pos : undefined
    if (captured) { setPos(captured); return }
    if (!anchorSel) { setPos(null); return }
    let cancelled = false
    function place() {
      if (cancelled) return
      const rects = [...document.querySelectorAll(anchorSel!)]
        .map(el => el.getBoundingClientRect())
        .filter(r => r.width > 0 && r.height > 0)
      if (!rects.length) { setPos(null); return }
      const left = Math.min(...rects.map(r => r.left))
      const top = Math.min(...rects.map(r => r.top))
      const right = Math.max(...rects.map(r => r.right))
      setPos(autoModalPos({ left, top, right, width: right - left, height: 0 }, window.innerWidth, window.innerHeight))
    }
    place()
    const t = setTimeout(place, 90)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

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
        // Light scrim (not a blackout) so the pointed-at sidebar stays readable.
        background: 'rgba(0, 0, 0, 0.55)',
      }}>

      {/* Keyframes for the pointer arrow's horizontal nudge. */}
      <style>{`@keyframes tourArrowNudge { 0%,100%{ transform: translateX(0) } 50%{ transform: translateX(-9px) } }`}</style>

      {/* Ring + arrow pinned to the anchored sidebar link. Rendered outside the
          panel so dragging the panel doesn't move them. pointer-events:none so
          they never intercept clicks. */}
      {anchorRect && (
        <>
          <div style={{
            // Clamp left on-screen (sidebar links sit flush at x~0, so left-6
            // clipped off the viewport) and pull the right in a touch.
            position: 'fixed', left: Math.max(6, anchorRect.left), top: anchorRect.top - 4,
            width: Math.max(40, anchorRect.right - 6 - Math.max(6, anchorRect.left)), height: anchorRect.height + 8,
            border: '2px solid #c0392b', borderRadius: '6px',
            boxShadow: '0 0 0 3px rgba(192,57,43,0.22), 0 0 18px rgba(192,57,43,0.55)',
            pointerEvents: 'none', zIndex: 1001,
          }} />
          <div style={{
            position: 'fixed', left: anchorRect.right + 10,
            top: anchorRect.top + anchorRect.height / 2 - 17,
            fontSize: '30px', color: '#c0392b', lineHeight: 1,
            textShadow: '0 1px 4px rgba(0,0,0,0.9)', pointerEvents: 'none', zIndex: 1001,
            animation: 'tourArrowNudge 0.9s ease-in-out infinite',
          }}>&#9664;</div>
        </>
      )}

      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          // Same clamp on the horizontal axis - the right-hand steps (x: 937)
          // ran off the edge of a 1366-wide screen.
          left: pos ? `max(12px, min(${Math.round(pos.x)}px, calc(100vw - ${stepWidth}px - 12px)))` : '50%',
          top: pos ? pos.y : '50%',
          transform: pos ? 'none' : 'translate(-50%, -50%)',
          width: '100%', maxWidth: `min(${stepWidth}px, calc(100vw - 24px))`,
          // A step's `pos.y` is a fixed coordinate captured on one screen. On a
          // shorter one the panel used to run off the bottom, taking the Next
          // and Skip buttons with it - the tour dead-ended with no way forward.
          // Capping the height to the space actually below `pos.y` keeps the
          // footer on screen and lets the body scroll instead. On a tall screen
          // the cap exceeds the natural height, so nothing scrolls.
          maxHeight: pos ? `calc(100vh - ${Math.round(pos.y)}px - 12px)` : '92vh',
          background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '6px',
          boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
          fontFamily: 'Carlito, sans-serif', color: '#f5f2ee',
          display: 'flex', flexDirection: 'column',
          zIndex: 1002,
        }}>

        {/* Drag grip - direct child of the panel so useDragPosition tracks it. */}
        <div
          onMouseDown={onHandleMouseDown}
          title="Drag to move"
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
            height: calibrate ? '24px' : '18px', flexShrink: 0, cursor: 'move',
            borderBottom: '1px solid #161616', borderRadius: '6px 6px 0 0',
            background: '#141414', color: '#4a4a4a', letterSpacing: '3px', fontSize: '13px',
          }}>
          &#8942;&#8942;&#8942;
          {calibrate && (
            <div onMouseDown={e => e.stopPropagation()}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px', letterSpacing: 'normal' }}>
              <span style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif' }}>
                {pos ? `${stepLabel}: ${Math.round(pos.x)}, ${Math.round(pos.y)}` : `${stepLabel}: centered`}
              </span>
              <button
                onClick={() => { if (pos) navigator.clipboard?.writeText(`pos: { x: ${Math.round(pos.x)}, y: ${Math.round(pos.y)} },`) }}
                style={{ fontSize: '13px', padding: '1px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#cce0f5', cursor: 'pointer', fontFamily: 'Carlito, sans-serif' }}>copy</button>
            </div>
          )}
        </div>

        {/* Header: progress + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: '1px solid #1e1e1e', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '6px', flex: 1 }} onMouseDown={e => e.stopPropagation()}>
            {steps.map((_, i) => (
              <div key={i}
                onClick={() => setStep(i)}
                title={`Step ${i + 1} of ${total}`}
                style={{ width: i === idx ? '22px' : '9px', height: '9px', borderRadius: '5px', background: i === idx ? '#c0392b' : i < idx ? '#7a1f16' : '#2e2e2e', cursor: 'pointer', transition: 'width .15s, background .15s' }} />
            ))}
          </div>
          <span style={{ fontSize: '13px', color: '#f5f2ee', flexShrink: 0 }}>Step {idx + 1} of {total}</span>
          <button onClick={dismiss} aria-label="Close"
            style={{ width: '28px', height: '28px', background: 'rgba(20,20,20,0.9)', border: '1px solid #3a3a3a', borderRadius: '50%', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: 0 }}>&#10005;</button>
        </div>

        {/* Content (scrolls; nav stays pinned) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem' }}>
          {current.kind === 'welcome' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minHeight: '100%' }}>
              <img src="/distemper-dogsign-logo.png" alt="Distemper" style={{ width: '128px', height: '128px', objectFit: 'contain', marginBottom: '1rem' }} />
              <div style={{ fontSize: '13px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#c0392b', marginBottom: '6px' }}>Welcome to</div>
              <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '42px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', lineHeight: 1, marginBottom: '6px' }}>The Tapestry</div>
              <div style={{ fontSize: '13px', letterSpacing: '.15em', textTransform: 'uppercase', color: '#cce0f5', marginBottom: '1rem' }}>DistemperVerse v1.0</div>
              <div style={{ fontSize: '17px', color: '#f5f2ee', width: '100%', lineHeight: 1.7, textAlign: 'left' }}>
                {WELCOME_PITCH.map((p, i) => (
                  <p key={i} style={{ marginBottom: '0.85rem' }}>{renderInline(p)}</p>
                ))}
              </div>
              {username && (
                <div style={{ fontSize: '17px', color: '#f5f2ee', width: '100%', textAlign: 'left', marginTop: 'auto', paddingTop: '0.85rem' }}>
                  Good luck, <span style={{ fontWeight: 700, color: '#c0392b' }}>{username}</span>. You&apos;re gonna need it.
                </div>
              )}
            </div>
          )}

          {current.kind === 'section' && (
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '40px', flexShrink: 0, marginTop: '2px' }}>{current.emoji}</div>
              <div>
                <div style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '24px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '10px' }}>
                  {current.title}
                </div>
                <div style={{ fontSize: '17px', color: '#f5f2ee', lineHeight: 1.7 }}>
                  {current.body.map((p, i) => (
                    <p key={i} style={i < current.body.length - 1 || current.list ? { marginBottom: '0.6rem' } : {}}>{renderInline(p)}</p>
                  ))}
                  {current.list && (
                    <ul style={{ paddingLeft: '1.2rem', margin: 0, lineHeight: 1.9 }}>
                      {current.list.map(item => <li key={item}>{renderInline(item)}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {current.kind === 'video' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎬</div>
              <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>{VIDEO_HEADING}</div>
              <div style={{ fontSize: '15px', color: '#cce0f5', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 18px' }}>
                {VIDEO_SUBTITLE}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {TOUR_VIDEOS.map(v => (
                  <a key={v.id} href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer"
                    style={{ display: 'block', textDecoration: 'none', border: '1px solid #2e2e2e', borderRadius: '4px', overflow: 'hidden', background: '#141414' }}>
                    <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#000' }}>
                      <img src={`https://img.youtube.com/vi/${v.id}/hqdefault.jpg`} alt={v.label}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(192,57,43,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '15px', paddingLeft: '3px' }}>&#9654;</div>
                      </div>
                    </div>
                    <div style={{ padding: '7px 9px', fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textAlign: 'left' }}>{v.label}</div>
                  </a>
                ))}
              </div>
              <div style={{ marginTop: '18px', fontSize: '15px', color: '#f5f2ee' }}>That&apos;s the tour. Welcome to the DistemperVerse.</div>
            </div>
          )}
        </div>

        {/* Footer nav - Back / Skip / Next|Enter. Skip + X + backdrop + ESC all
            dismiss at every step; there is intentionally no way to get trapped. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderTop: '1px solid #1e1e1e', flexShrink: 0 }}>
          <button onClick={back} disabled={isFirst} style={navBtn(false, isFirst)}>&#8592; Back</button>
          <div style={{ flex: 1 }} />
          {!isLast && (
            <button onClick={dismiss} style={{ background: 'none', border: 'none', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', padding: '6px 10px' }}>Skip tour</button>
          )}
          <button onClick={next} style={navBtn(true)}>{isLast ? 'Enter The Tapestry' : 'Next →'}</button>
        </div>
      </div>
    </div>
  )
}
