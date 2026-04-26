'use client'
import { useEffect, useMemo, useState } from 'react'

// /campfire/timestamp — HammerTime-style timestamp generator. Pick a date
// + time + source timezone and copy a Discord-style <t:UNIX:format>
// token that anyone (or any platform that parses these) renders in
// their own local timezone. The tokens cross-post to Discord cleanly,
// and a follow-up Tapestry-side renderer (TODO) can convert them to
// localized <time> elements in user content here too.
//
// Format reference (matches Discord + HammerTime):
//   t / T  — short / long time
//   d / D  — short / long date
//   f / F  — short / long date+time
//   R      — relative ("in 2 hours", "5 minutes ago")

interface FormatRow {
  code: string
  label: string
  render: (date: Date) => string
}

const FORMATS: FormatRow[] = [
  { code: 'd', label: 'Short date',
    render: d => d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' }) },
  { code: 'D', label: 'Long date',
    render: d => d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) },
  { code: 't', label: 'Short time',
    render: d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) },
  { code: 'T', label: 'Long time',
    render: d => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }) },
  { code: 'f', label: 'Short date + time',
    render: d => d.toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) },
  { code: 'F', label: 'Long date + time',
    render: d => d.toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) },
  { code: 'R', label: 'Relative',
    render: d => formatRelative(d) },
]

function formatRelative(date: Date): string {
  const now = Date.now()
  const diffMs = date.getTime() - now
  const sign = diffMs >= 0 ? 'in' : 'ago'
  const abs = Math.abs(diffMs)
  const seconds = Math.round(abs / 1000)
  const minutes = Math.round(seconds / 60)
  const hours = Math.round(minutes / 60)
  const days = Math.round(hours / 24)
  const weeks = Math.round(days / 7)
  const months = Math.round(days / 30)
  const years = Math.round(days / 365)
  let value: number
  let unit: string
  if (seconds < 60)      { value = seconds; unit = seconds === 1 ? 'second' : 'seconds' }
  else if (minutes < 60) { value = minutes; unit = minutes === 1 ? 'minute' : 'minutes' }
  else if (hours < 24)   { value = hours; unit = hours === 1 ? 'hour' : 'hours' }
  else if (days < 7)     { value = days; unit = days === 1 ? 'day' : 'days' }
  else if (weeks < 5)    { value = weeks; unit = weeks === 1 ? 'week' : 'weeks' }
  else if (months < 12)  { value = months; unit = months === 1 ? 'month' : 'months' }
  else                   { value = years; unit = years === 1 ? 'year' : 'years' }
  return sign === 'in' ? `in ${value} ${unit}` : `${value} ${unit} ago`
}

// Convert "datetime-local" string + source timezone → unix seconds.
// Trick: parse the datetime-local string as if it were UTC, then offset
// by the source TZ's offset at that moment. Handles DST automatically
// because the offset is recomputed via Intl per-instant.
function unixFromTzInput(dateTimeLocal: string, tz: string): number {
  if (!dateTimeLocal) return 0
  const fakeUtc = new Date(dateTimeLocal + 'Z')
  if (isNaN(fakeUtc.getTime())) return 0
  const utcLocale = new Date(fakeUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
  const tzLocale = new Date(fakeUtc.toLocaleString('en-US', { timeZone: tz }))
  const offsetMs = tzLocale.getTime() - utcLocale.getTime()
  return Math.floor((fakeUtc.getTime() - offsetMs) / 1000)
}

function getCurrentLocalIsoMinute(): string {
  // Build a YYYY-MM-DDTHH:MM string in the BROWSER'S local time, suitable
  // for an <input type="datetime-local"> value.
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function TimestampPage() {
  const [dateTime, setDateTime] = useState<string>('')
  const [tz, setTz] = useState<string>('')
  const [copiedFlash, setCopiedFlash] = useState<string | null>(null)

  // Initialize once on mount: default the date input to "now" and the
  // timezone to the viewer's browser timezone.
  useEffect(() => {
    setDateTime(getCurrentLocalIsoMinute())
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
    } catch { setTz('UTC') }
  }, [])

  // Available timezone list. Modern browsers expose Intl.supportedValuesOf
  // ('timeZone') which gives ~600 IANA zones. Fall back to a small curated
  // list for older runtimes.
  const tzOptions = useMemo<string[]>(() => {
    try {
      const fn = (Intl as any).supportedValuesOf
      if (typeof fn === 'function') {
        const list = fn('timeZone') as string[]
        if (Array.isArray(list) && list.length > 0) return list
      }
    } catch { /* fall through */ }
    return [
      'UTC',
      'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York',
      'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
      'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai',
      'Australia/Sydney', 'Australia/Perth',
    ]
  }, [])

  const unix = useMemo(() => unixFromTzInput(dateTime, tz || 'UTC'), [dateTime, tz])
  const previewDate = useMemo(() => unix > 0 ? new Date(unix * 1000) : null, [unix])

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedFlash(key)
      setTimeout(() => setCopiedFlash(prev => prev === key ? null : prev), 1500)
    } catch {
      window.prompt('Copy:', text)
    }
  }

  // ── Styles ───────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#242424',
    border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee',
    fontSize: '14px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: '13px', color: '#cce0f5',
    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.06em',
    textTransform: 'uppercase', marginBottom: '4px',
  }
  const tableCell: React.CSSProperties = {
    padding: '10px 12px', borderTop: '1px solid #2e2e2e',
    fontSize: '14px', color: '#f5f2ee', verticalAlign: 'middle',
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem', fontFamily: 'Barlow, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '28px', fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '6px' }}>
          Timestamps
        </div>
        <div style={{ fontSize: '14px', color: '#5a8a40', lineHeight: 1.6 }}>
          Pick a moment in any timezone and copy a token that renders in every viewer's own local time.
          Works inline on Discord; a Tapestry-side renderer is on the way for use in posts here too.
        </div>
      </div>

      {/* Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem', background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1rem 1.25rem' }}>
        <div>
          <label style={lbl}>Date and Time</label>
          <input type="datetime-local"
            value={dateTime}
            onChange={e => setDateTime(e.target.value)}
            style={inp} />
        </div>
        <div>
          <label style={lbl}>Source Timezone</label>
          <select value={tz} onChange={e => setTz(e.target.value)}
            style={{ ...inp, appearance: 'none', cursor: 'pointer' }}>
            {tzOptions.map(z => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Output table */}
      <div style={{ background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', padding: '10px 12px', background: '#0f0f0f', borderBottom: '1px solid #2e2e2e' }}>
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>Format</div>
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>Token</div>
          <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }}>Your local preview</div>
        </div>
        {FORMATS.map(f => {
          const token = `<t:${unix}:${f.code}>`
          const preview = previewDate ? f.render(previewDate) : '—'
          const flashing = copiedFlash === f.code
          return (
            <div key={f.code} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', alignItems: 'center' }}>
              <div style={{ ...tableCell, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', color: '#d4cfc9' }}>
                {f.label}
              </div>
              <div style={tableCell}>
                <button onClick={() => copy(token, f.code)}
                  title="Click to copy"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: flashing ? '#1a2e10' : '#242424', border: `1px solid ${flashing ? '#2d5a1b' : '#3a4a6a'}`, borderRadius: '3px', color: flashing ? '#7fc458' : '#7ab3d4', fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer' }}>
                  📋 {flashing ? 'Copied!' : token}
                </button>
              </div>
              <div style={{ ...tableCell, color: '#cce0f5' }}>{preview}</div>
            </div>
          )
        })}
        {/* Raw unix row, useful for systems that take the integer directly */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', alignItems: 'center' }}>
          <div style={{ ...tableCell, fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '.04em', color: '#d4cfc9' }}>
            Unix seconds
          </div>
          <div style={tableCell}>
            <button onClick={() => copy(String(unix), 'unix')}
              title="Click to copy"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: copiedFlash === 'unix' ? '#1a2e10' : '#242424', border: `1px solid ${copiedFlash === 'unix' ? '#2d5a1b' : '#3a4a6a'}`, borderRadius: '3px', color: copiedFlash === 'unix' ? '#7fc458' : '#7ab3d4', fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer' }}>
              📋 {copiedFlash === 'unix' ? 'Copied!' : String(unix)}
            </button>
          </div>
          <div style={{ ...tableCell, color: '#5a5550', fontStyle: 'italic' }}>
            (raw integer — paste into anything that takes a unix epoch)
          </div>
        </div>
      </div>

      {/* Help */}
      <div style={{ marginTop: '1.25rem', fontSize: '13px', color: '#5a5550', lineHeight: 1.6 }}>
        Tip — these tokens are the same format Discord uses for{' '}
        <a href="https://discord.com/developers/docs/reference#message-formatting-timestamp-styles" target="_blank" rel="noreferrer" style={{ color: '#7ab3d4' }}>timestamp messages</a>.
        Paste a copied token into any Discord channel and it renders in everyone's local time automatically.
      </div>
    </div>
  )
}
