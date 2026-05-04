'use client'
// BugReportButton — 🐛 icon in the sidebar's user-header icon row.
// Click opens a modal with a textarea; submit inserts a bug_reports
// row, the DB trigger fires call_notify_thriver to email Xero.
//
// Captures alongside the user-typed description:
//   • page_url     — window.location.href at submit time
//   • user_agent   — navigator.userAgent
//   • reporter_id  — auth.uid() (or null for ghost guests, which the
//                    RLS policy explicitly allows)
//   • reporter_name + reporter_email — denormalized so the report
//                    survives even if the user later deletes their
//                    profile.
//
// Layout: same flex:1 cell pattern as MessagesBell / NotificationBell
// so the four icons are evenly spaced in the sidebar.

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { getCachedAuth } from '../lib/auth-cache'
import { ModalBackdrop, Z_INDEX } from '../lib/style-helpers'

export default function BugReportButton() {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string>('')
  // Lazy-loaded reporter info so we have name + email handy without
  // forcing the modal to wait on auth at render time.
  const [reporter, setReporter] = useState<{ id: string | null; email: string | null; name: string | null }>({ id: null, email: null, name: null })

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const { user } = await getCachedAuth()
      if (!user) { setReporter({ id: null, email: null, name: null }); return }
      const { data: prof } = await supabase.from('profiles').select('username, email').eq('id', user.id).maybeSingle()
      setReporter({
        id: user.id,
        email: (prof as any)?.email ?? user.email ?? null,
        name: (prof as any)?.username ?? null,
      })
    })()
  }, [open, supabase])

  async function handleSubmit() {
    if (!draft.trim() || submitting) return
    setSubmitting(true)
    setError('')
    const { error: insertErr } = await supabase.from('bug_reports').insert({
      reporter_id: reporter.id,
      reporter_email: reporter.email,
      reporter_name: reporter.name,
      page_url: typeof window !== 'undefined' ? window.location.href : null,
      description: draft.trim(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
    setSubmitting(false)
    if (insertErr) {
      setError(`Submit failed: ${insertErr.message}`)
      return
    }
    setSubmitted(true)
    setDraft('')
    // Auto-close after a short success display so the modal doesn't
    // park on screen.
    setTimeout(() => { setSubmitted(false); setOpen(false) }, 1800)
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        title="Report a bug"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '16px', lineHeight: 1, padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#cce0f5',
        }}>
        🐛
      </button>

      {open && (
        <ModalBackdrop onClose={() => { if (!submitting) setOpen(false) }} zIndex={Z_INDEX.criticalModal} opacity={0.85} padding="1rem">
          <div style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderLeft: '3px solid #c0392b', borderRadius: '4px', padding: '1.25rem', width: '460px', maxWidth: '94vw' }}>
            <div style={{ fontSize: '13px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
              🐛 Report a Bug
            </div>
            <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow, sans-serif', marginBottom: '12px', lineHeight: 1.4 }}>
              What broke, what you expected, and anything else useful. We capture the page URL + your browser automatically.
            </div>
            <textarea value={draft} onChange={e => setDraft(e.target.value)}
              autoFocus disabled={submitting || submitted}
              placeholder="e.g. I clicked Save on a character and got a blank screen instead of the sheet."
              rows={6}
              style={{
                width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px',
                color: '#f5f2ee', fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box', resize: 'vertical',
              }} />
            <div style={{ marginTop: '4px', fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow, sans-serif' }}>
              Page: {typeof window !== 'undefined' ? window.location.pathname : '(unknown)'}
            </div>
            {error && (
              <div style={{ marginTop: '8px', padding: '6px 10px', background: '#2a1210', border: '1px solid #c0392b', borderRadius: '3px', fontSize: '13px', color: '#f5a89a', fontFamily: 'Carlito, sans-serif' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={handleSubmit} disabled={!draft.trim() || submitting || submitted}
                style={{
                  padding: '8px 18px',
                  background: !draft.trim() || submitting ? '#242424' : '#2a1210',
                  border: `1px solid ${!draft.trim() || submitting ? '#3a3a3a' : '#c0392b'}`,
                  borderRadius: '3px',
                  color: !draft.trim() || submitting ? '#5a5550' : '#f5a89a',
                  fontSize: '13px', fontFamily: 'Carlito, sans-serif',
                  letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600,
                  cursor: !draft.trim() || submitting ? 'not-allowed' : 'pointer',
                }}>
                {submitting ? 'Submitting…' : submitted ? '✓ Sent — thanks' : '🐛 Submit'}
              </button>
              <button onClick={() => { if (!submitting) setOpen(false) }}
                disabled={submitting}
                style={{
                  padding: '8px 14px', background: 'transparent', border: '1px solid #3a3a3a', borderRadius: '3px',
                  color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em',
                  textTransform: 'uppercase', cursor: submitting ? 'not-allowed' : 'pointer',
                }}>
                Cancel
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </>
  )
}
