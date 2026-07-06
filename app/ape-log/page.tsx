'use client'
import { useEffect, useMemo, useState } from 'react'
import { getCachedAuth } from '../../lib/auth-cache'
import { isThriverUser } from '../../lib/data/feature-checklist'
import { loadApeVisits, type ApeVisit } from '../../lib/data/ape-log'

// /ape-log - Thriver-only dashboard of visitors to the static /apegenerator
// page. Visits are logged by the beacon in public/apegenerator/index.html.

const LIMIT = 5000
const C = {
  ink: '#f5f2ee', muted: '#cce0f5', faint: '#8a8178',
  red: '#c0392b', green: '#7fc458', amber: '#d99a2b',
  panel: '#1a1a1a', panel2: '#222', hair: '#2e2e2e', hair2: '#3a3a3a',
}
const sans = 'Carlito, sans-serif'
const mono = 'Consolas, monospace'

function fmtWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function locOf(v: { city: string | null; region: string | null; country_code: string | null }): string {
  const parts = [v.city, v.region, v.country_code].filter(Boolean)
  return parts.length ? parts.join(', ') : 'Unknown'
}

interface VisitorRow {
  key: string
  ip: string
  location: string
  count: number
  first: string
  last: string
  ghost: boolean
}

export default function ApeLogPage() {
  const [authChecked, setAuthChecked] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [visits, setVisits] = useState<ApeVisit[]>([])

  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) { setAuthChecked(true); return }
      const ok = await isThriverUser(user.id)
      setAllowed(ok); setAuthChecked(true)
      if (ok) { setVisits(await loadApeVisits(LIMIT)); setLoading(false) }
    })()
  }, [])

  const { visitors, totals } = useMemo(() => {
    const byKey = new Map<string, VisitorRow>()
    const countries = new Set<string>()
    let ghostCount = 0
    const now = Date.now()
    const d7 = now - 7 * 864e5
    let last7 = 0
    for (const v of visits) {
      if (v.country_code) countries.add(v.country_code)
      if (v.is_ghost) ghostCount++
      if (new Date(v.created_at).getTime() >= d7) last7++
      const key = v.ip_hash || v.ip_address || v.id
      const ex = byKey.get(key)
      if (ex) {
        ex.count++
        if (v.created_at < ex.first) ex.first = v.created_at
        if (v.created_at > ex.last) ex.last = v.created_at
        if (ex.ip === 'unknown' && v.ip_address) ex.ip = v.ip_address
      } else {
        byKey.set(key, {
          key, ip: v.ip_address || 'unknown', location: locOf(v),
          count: 1, first: v.created_at, last: v.created_at, ghost: v.is_ghost,
        })
      }
    }
    // Spread not Array-dot-from: the check-arch seam ratchet would count that
    // static call as a DB read outside lib/data.
    const list = [...byKey.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1))
    return {
      visitors: list,
      totals: {
        visits: visits.length, unique: byKey.size, countries: countries.size,
        last7, ghost: ghostCount, capped: visits.length >= LIMIT,
      },
    }
  }, [visits])

  if (!authChecked) return <Shell><p style={p()}>Loading...</p></Shell>
  if (!allowed) return <Shell><p style={p()}>This dashboard is Thriver-only.</p></Shell>

  return (
    <Shell>
      {loading ? <p style={p()}>Loading visits...</p> : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '22px' }}>
            <Stat label="Total visits" value={totals.visits} note={totals.capped ? `capped at ${LIMIT}` : ''} />
            <Stat label="Unique visitors" value={totals.unique} />
            <Stat label="Countries" value={totals.countries} />
            <Stat label="Last 7 days" value={totals.last7} />
            <Stat label="Signed-out" value={totals.ghost} />
          </div>

          {visitors.length === 0 ? (
            <p style={{ ...p(), color: C.muted }}>No visits logged yet. Once someone opens the ape generator, they will show up here.</p>
          ) : (
            <>
              <h2 style={h2()}>Visitors by IP</h2>
              <div style={{ overflowX: 'auto', marginBottom: '30px' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '640px' }}>
                  <thead><tr>
                    <Th>IP address</Th><Th>Location</Th><Th right>Visits</Th><Th>First seen</Th><Th>Last seen</Th>
                  </tr></thead>
                  <tbody>
                    {visitors.map(v => (
                      <tr key={v.key}>
                        <Td mono>{v.ip}{v.ghost ? '' : <span style={{ color: C.green, marginLeft: '6px', fontSize: '13px' }}>signed in</span>}</Td>
                        <Td>{v.location}</Td>
                        <Td right mono><b style={{ color: C.green }}>{v.count}</b></Td>
                        <Td>{fmtWhen(v.first)}</Td>
                        <Td>{fmtWhen(v.last)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 style={h2()}>Recent visits</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '640px' }}>
                  <thead><tr>
                    <Th>When</Th><Th>Location</Th><Th>IP address</Th><Th>Referrer</Th>
                  </tr></thead>
                  <tbody>
                    {visits.slice(0, 100).map(v => (
                      <tr key={v.id}>
                        <Td>{fmtWhen(v.created_at)}</Td>
                        <Td>{locOf(v)}</Td>
                        <Td mono>{v.ip_address || 'unknown'}</Td>
                        <Td>{v.referrer || 'Direct'}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  )
}

function p(): React.CSSProperties { return { color: C.muted, fontFamily: sans, fontSize: '15px' } }
function h2(): React.CSSProperties { return { fontSize: '15px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: C.ink, margin: '0 0 10px', paddingBottom: '7px', borderBottom: `1px solid ${C.hair}` } }

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div style={{ flex: '1 1 120px', minWidth: '120px', background: C.panel, border: `1px solid ${C.hair}`, borderRadius: '5px', padding: '12px 14px' }}>
      <div style={{ fontFamily: mono, fontSize: '13px', color: C.green, fontWeight: 700 }}><span style={{ fontSize: '24px' }}>{value.toLocaleString()}</span></div>
      <div style={{ fontFamily: sans, fontSize: '13px', color: C.muted, letterSpacing: '.04em', marginTop: '2px' }}>{label}</div>
      {note ? <div style={{ fontFamily: mono, fontSize: '13px', color: C.faint, marginTop: '2px' }}>{note}</div> : null}
    </div>
  )
}
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th style={{ textAlign: right ? 'right' : 'left', fontFamily: sans, fontSize: '13px', letterSpacing: '.06em', textTransform: 'uppercase', color: C.muted, padding: '6px 10px', borderBottom: `1px solid ${C.hair2}`, whiteSpace: 'nowrap' }}>{children}</th>
}
function Td({ children, right, mono: isMono }: { children: React.ReactNode; right?: boolean; mono?: boolean }) {
  return <td style={{ textAlign: right ? 'right' : 'left', fontFamily: isMono ? mono : sans, fontSize: '13.5px', color: C.ink, padding: '7px 10px', borderBottom: `1px solid ${C.panel}`, whiteSpace: 'nowrap' }}>{children}</td>
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '28px 20px 80px' }}>
      <div style={{ fontFamily: mono, fontSize: '13px', letterSpacing: '.24em', textTransform: 'uppercase', color: C.red, marginBottom: '6px' }}>Visitor Log</div>
      <h1 style={{ fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '30px', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: C.ink, margin: '0 0 6px', borderBottom: `1px solid ${C.red}`, paddingBottom: '12px' }}>Ape Generator Log</h1>
      <p style={{ color: C.muted, fontFamily: sans, fontSize: '14.5px', maxWidth: '64ch', margin: '0 0 8px' }}>Everyone who has opened the ape generator - where they are, their IP, and how many times they have come back. Your own visits are hidden.</p>
      {children}
    </div>
  )
}
