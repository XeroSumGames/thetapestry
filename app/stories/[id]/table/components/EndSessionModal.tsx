'use client'
// EndSessionModal - GM "End Session" summary dialog. Extracted from page.tsx
// verbatim (table re-arch Step 2). Presentational; the summary / cliffhanger /
// next-notes / file state + the endSession action are threaded as props (the
// state migrates to useGmTools later). Fill the three summary fields, attach
// files, then End Session - or open the session log via the Append Log link.

interface EndSessionModalProps {
  open: boolean
  onClose: () => void
  sessionCount: number
  submittedPlayerNotes: any[]
  sessionSummary: string
  setSessionSummary: React.Dispatch<React.SetStateAction<string>>
  sessionCliffhanger: string
  setSessionCliffhanger: React.Dispatch<React.SetStateAction<string>>
  nextSessionNotes: string
  setNextSessionNotes: React.Dispatch<React.SetStateAction<string>>
  sessionFiles: File[]
  setSessionFiles: React.Dispatch<React.SetStateAction<File[]>>
  campaignId: string
  campaignName: string
  sessionActing: boolean
  endSession: () => void | Promise<unknown>
}

export function EndSessionModal({
  open, onClose, sessionCount, submittedPlayerNotes,
  sessionSummary, setSessionSummary, sessionCliffhanger, setSessionCliffhanger,
  nextSessionNotes, setNextSessionNotes, sessionFiles, setSessionFiles,
  campaignId, campaignName, sessionActing, endSession,
}: EndSessionModalProps) {
  if (!open) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: '13px', color: '#c0392b', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>End Session</div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '1.25rem' }}>Session {sessionCount} Summary</div>

        {/* Player submissions - notes the players flagged "Add to Session Summary". */}
        {submittedPlayerNotes.length > 0 && (
          <div style={{ marginBottom: '1.25rem', padding: '10px', background: '#0f2035', border: '1px solid #1a3a5c', borderRadius: '3px' }}>
            <div style={{ fontSize: '13px', color: '#7ab3d4', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '8px' }}>Player Submissions ({submittedPlayerNotes.length})</div>
            {submittedPlayerNotes.map(n => (
              <div key={n.id} style={{ marginBottom: '8px', padding: '6px 8px', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '3px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#7ab3d4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '2px' }}>{n.character_name}</div>
                {n.title && <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', marginBottom: '2px' }}>{n.title}</div>}
                <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4, marginBottom: '6px' }}>{n.content}</div>
                <button onClick={() => {
                  const titlePart = n.title ? ` - ${n.title}` : ''
                  const block = (sessionSummary.trim() ? '\n\n' : '') + `${n.character_name}${titlePart}: ${n.content}`
                  setSessionSummary(prev => prev + block)
                }}
                  style={{ padding: '3px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Append to Summary
                </button>
              </div>
            ))}
          </div>
        )}

        {/* What happened */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>What happened this session?</div>
          <textarea
            value={sessionSummary}
            onChange={e => setSessionSummary(e.target.value)}
            placeholder="Summarise the session - key events, decisions, outcomes."
            autoFocus
            rows={6}
            style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
        </div>

        {/* How did the session end */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>How did the session end?</div>
          <textarea
            value={sessionCliffhanger}
            onChange={e => setSessionCliffhanger(e.target.value)}
            placeholder="What do you need to remember? What was the cliffhanger? Who had the last word?"
            rows={3}
            style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
        </div>

        {/* Notes for next session */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Notes for next session</div>
          <textarea
            value={nextSessionNotes}
            onChange={e => setNextSessionNotes(e.target.value)}
            placeholder="Prep notes, loose threads, things to follow up on."
            rows={4}
            style={{ width: '100%', padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
        </div>

        {/* File upload */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '13px', color: '#cce0f5', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'Carlito, sans-serif', marginBottom: '6px' }}>Attach files (optional)</div>
          <div
            onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#c0392b' }}
            onDragLeave={e => { e.currentTarget.style.borderColor = '#3a3a3a' }}
            onDrop={e => {
              e.preventDefault()
              e.currentTarget.style.borderColor = '#3a3a3a'
              const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || f.type === 'text/plain' || f.type === 'application/msword' || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
              if (files.length > 0) setSessionFiles(prev => [...prev, ...files])
            }}
            style={{ border: '2px dashed #3a3a3a', borderRadius: '4px', padding: '1.25rem', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s' }}
            onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'image/*,.pdf,.txt,.doc,.docx'; input.onchange = () => { const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || f.type === 'text/plain' || f.type === 'application/msword' || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); if (files.length > 0) setSessionFiles(prev => [...prev, ...files]) }; input.click() }}
          >
            <div style={{ fontSize: '15px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
              Drop files here or click to browse
            </div>
            <div style={{ fontSize: '14px', color: '#cce0f5', marginTop: '4px' }}>Maps, handouts, references - images, PDFs, text, and Word docs</div>
          </div>
          {sessionFiles.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              {sessionFiles.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#242424', border: '1px solid #2e2e2e', borderRadius: '3px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: '#d4cfc9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button onClick={() => setSessionFiles(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', color: '#cce0f5', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
          <button onClick={endSession} disabled={sessionActing} style={{ flex: 2, padding: '10px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', cursor: sessionActing ? 'not-allowed' : 'pointer', opacity: sessionActing ? 0.6 : 1 }}>
            {sessionActing ? 'Ending...' : 'End Session'}
          </button>
        </div>
        {/* Append Log: opens the campaign's session log (new tab, so the
            in-progress summary above isn't lost). Replaces the old
            download-export button (Xero 2026-05-25). */}
        <div style={{ marginTop: '10px', textAlign: 'center' }}>
          <a href={`/stories/${campaignId}/sessions`} target="_blank" rel="noopener noreferrer"
            style={{ color: '#7ab3d4', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textDecoration: 'underline' }}>
            Append Log →
          </a>
        </div>
      </div>
    </div>
  )
}
