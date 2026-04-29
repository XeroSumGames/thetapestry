'use client'
import { useState } from 'react'
import { createClient } from '../lib/supabase-browser'
import { renderRichText } from '../lib/rich-text'

export interface LogEntry {
  date: string
  type: 'cdp' | 'wound' | 'stress' | 'insight' | 'item' | 'kill' | 'session' | 'note' | 'skill' | 'attribute' | 'community' | 'pin' | 'relationship'
  text: string
}

const TYPE_COLORS: Record<string, string> = {
  cdp: '#7ab3d4',
  wound: '#c0392b',
  stress: '#EF9F27',
  insight: '#d48bd4',
  item: '#7fc458',
  kill: '#f5a89a',
  session: '#cce0f5',
  note: '#d4cfc9',
  skill: '#7ab3d4',
  attribute: '#7ab3d4',
  community: '#a87fc4',
  pin: '#ddc070',
  relationship: '#e8a87c',
}

const TYPE_LABELS: Record<string, string> = {
  cdp: 'CDP',
  wound: 'Wound',
  stress: 'Stress',
  insight: 'Insight',
  item: 'Item',
  kill: 'Kill',
  session: 'Session',
  note: 'Note',
  skill: 'Skill',
  attribute: 'Attribute',
  community: 'Community',
  pin: 'Pin',
  relationship: 'Met',
}

interface Props {
  characterId: string
  log: LogEntry[]
  canEdit: boolean
  onUpdate: (log: LogEntry[]) => void
  compact?: boolean
}

export default function ProgressionLog({ characterId, log, canEdit, onUpdate, compact = false }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [filter, setFilter] = useState<string | null>(null)

  function addNote() {
    if (!noteText.trim()) return
    const entry: LogEntry = {
      date: new Date().toISOString(),
      type: 'note',
      text: noteText.trim(),
    }
    onUpdate([entry, ...log])
    setNoteText('')
    setShowAdd(false)
  }

  function removeEntry(idx: number) {
    onUpdate(log.filter((_, i) => i !== idx))
  }

  const filtered = filter ? log.filter(e => e.type === filter) : log
  const displayed = compact ? filtered.slice(0, 10) : filtered

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', color: '#c0392b', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>Progression Log</span>
        <span style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif' }}>{log.length} entries</span>
        {canEdit && (
          <button onClick={() => setShowAdd(!showAdd)} style={{ marginLeft: 'auto', padding: '2px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#d4cfc9', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer' }}>
            {showAdd ? 'Cancel' : '+ Note'}
          </button>
        )}
      </div>

      {/* Add note */}
      {showAdd && (
        <div style={{ marginBottom: '6px', display: 'flex', gap: '4px' }}>
          <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="What happened..."
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') addNote() }}
            style={{ flex: 1, padding: '4px 8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }} />
          <button onClick={addNote} disabled={!noteText.trim()}
            style={{ padding: '4px 8px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', color: '#7fc458', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: noteText.trim() ? 'pointer' : 'not-allowed' }}>Add</button>
        </div>
      )}

      {/* Filter chips */}
      {!compact && log.length > 3 && (
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {Object.entries(TYPE_LABELS).filter(([type]) => log.some(e => e.type === type)).map(([type, label]) => (
            <button key={type} onClick={() => setFilter(filter === type ? null : type)}
              style={{ padding: '1px 6px', borderRadius: '2px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', background: filter === type ? '#242424' : 'transparent', border: `1px solid ${filter === type ? TYPE_COLORS[type] : '#3a3a3a'}`, color: filter === type ? TYPE_COLORS[type] : '#5a5550' }}>
              {label}
            </button>
          ))}
          {filter && (
            <button onClick={() => setFilter(null)} style={{ padding: '1px 6px', borderRadius: '2px', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', cursor: 'pointer', background: 'none', border: '1px solid #3a3a3a', color: '#f5a89a' }}>Clear</button>
          )}
        </div>
      )}

      {/* Entries */}
      {displayed.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', textAlign: 'center', padding: '12px' }}>No entries yet</div>
      ) : (
        displayed.map((entry, idx) => (
          <div key={`${entry.date}-${idx}`} style={{ display: 'flex', gap: '6px', padding: '3px 0', borderBottom: '1px solid #1a1a1a', fontSize: '13px' }}>
            <span style={{ fontSize: '13px', color: TYPE_COLORS[entry.type] ?? '#d4cfc9', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', minWidth: '50px', flexShrink: 0 }}>{TYPE_LABELS[entry.type] ?? entry.type}</span>
            <span style={{ color: '#d4cfc9', flex: 1 }}>{renderRichText(entry.text)}</span>
            <span style={{ fontSize: '13px', color: '#cce0f5', flexShrink: 0 }}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            {canEdit && entry.type === 'note' && (
              <button onClick={() => removeEntry(idx)} style={{ background: 'none', border: 'none', color: '#cce0f5', fontSize: '13px', cursor: 'pointer', padding: '0 2px' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f5a89a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#cce0f5')}>×</button>
            )}
          </div>
        ))
      )}

      {compact && log.length > 10 && (
        <div style={{ fontSize: '13px', color: '#5a5550', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', padding: '4px', textTransform: 'uppercase' }}>
          +{log.length - 10} more entries
        </div>
      )}
    </div>
  )
}

// Helper: auto-log an event (call from outside to append entries)
export function createLogEntry(type: LogEntry['type'], text: string): LogEntry {
  return { date: new Date().toISOString(), type, text }
}
