'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase-browser'
import { getCachedAuth } from '../../../lib/auth-cache'
import {
  computeReseedPlan,
  applyReseedPlan,
  type ReseedPlan,
} from '../../../lib/setting-reseed'

// /tools/reseed-campaign — Thriver-only. Pulls in setting content
// (pins / NPCs / scenes / handouts) that has been added to the seed
// configs since a campaign was created. Idempotent: matches existing
// rows by name/title and only inserts what's missing. Preview-then-
// confirm so the GM can spot a renamed-by-GM duplicate before it lands.

interface Campaign {
  id: string
  name: string
  setting: string | null
}

const panel: React.CSSProperties = { background: '#1a1a1a', border: '1px solid #2e2e2e', borderRadius: '4px', padding: '1.25rem', marginBottom: '1rem' }
const h1Style: React.CSSProperties = { fontFamily: 'Distemper, Carlito, sans-serif', fontSize: '26px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '8px', borderBottom: '1px solid #c0392b', paddingBottom: '12px', lineHeight: 1.1 }
const subLabel: React.CSSProperties = { fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase' }
const btnPrimary: React.CSSProperties = { padding: '8px 18px', background: '#c0392b', border: '1px solid #c0392b', borderRadius: '3px', color: '#fff', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { ...btnPrimary, background: '#242424', border: '1px solid #3a3a3a', color: '#d4cfc9' }

export default function ReseedCampaignPage() {
  const supabase = createClient()
  const [authChecked, setAuthChecked] = useState(false)
  const [isThriver, setIsThriver] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignId, setCampaignId] = useState<string>('')
  const [plan, setPlan] = useState<ReseedPlan | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [computing, setComputing] = useState(false)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ pins: number; npcs: number; scenes: number; handouts: number; errors: string[] } | null>(null)

  useEffect(() => {
    (async () => {
      const { user } = await getCachedAuth()
      if (!user) { setAuthChecked(true); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      const thriver = (profile?.role ?? '').toString().toLowerCase() === 'thriver'
      setIsThriver(thriver)
      if (thriver) {
        // Thriver bypass on campaigns RLS lets us list every campaign,
        // not just the GM's own. Order by name for scannability.
        const { data } = await supabase.from('campaigns').select('id, name, setting').order('name')
        setCampaigns((data ?? []) as Campaign[])
      }
      setAuthChecked(true)
    })()
  }, [])

  async function handlePreview() {
    if (!campaignId) return
    setComputing(true)
    setResult(null)
    setPlan(null)
    setPlanError(null)
    const out = await computeReseedPlan(supabase, campaignId)
    if ('error' in out) {
      setPlanError(out.error)
    } else {
      setPlan(out)
    }
    setComputing(false)
  }

  async function handleApply() {
    if (!plan) return
    if (!confirm(`Apply re-seed? Adds ${plan.pinsToAdd.length} pins, ${plan.npcsToAdd.length} NPCs, ${plan.scenesToAdd.length} scenes, ${plan.handoutsToAdd.length} handouts.`)) return
    setApplying(true)
    const out = await applyReseedPlan(supabase, plan)
    setResult(out)
    setApplying(false)
    // Plan is now stale; clear so the user can re-preview if they want.
    setPlan(null)
  }

  if (!authChecked) return null
  if (!isThriver) return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'Barlow, sans-serif', color: '#cce0f5', textAlign: 'center' }}>
      Thriver access only.
    </div>
  )

  const totalToAdd = plan
    ? plan.pinsToAdd.length + plan.npcsToAdd.length + plan.scenesToAdd.length + plan.handoutsToAdd.length
    : 0

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '1.5rem 1rem 4rem', fontFamily: 'Barlow, sans-serif', color: '#f5f2ee' }}>
      <div style={h1Style}>Reseed Campaign</div>
      <div style={panel}>
        <div style={{ ...subLabel, marginBottom: '8px' }}>Campaign</div>
        <select value={campaignId} onChange={e => { setCampaignId(e.target.value); setPlan(null); setResult(null); setPlanError(null) }}
          style={{ width: '100%', padding: '8px 10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '14px', fontFamily: 'Carlito, sans-serif', boxSizing: 'border-box', marginBottom: '12px' }}>
          <option value="">— pick a campaign —</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.setting ? ` · ${c.setting}` : ''}</option>
          ))}
        </select>
        <button onClick={handlePreview} disabled={!campaignId || computing} style={{ ...btnSecondary, opacity: !campaignId || computing ? 0.5 : 1 }}>
          {computing ? 'Computing…' : 'Preview What Would Be Added'}
        </button>
      </div>

      {planError && (
        <div style={{ ...panel, background: '#2a1210', border: '1px solid #7a1f16', color: '#f5a89a' }}>
          {planError}
        </div>
      )}

      {plan && (
        <div style={panel}>
          <div style={{ ...subLabel, marginBottom: '6px' }}>Setting: <span style={{ color: '#f5f2ee' }}>{plan.setting}</span></div>
          {totalToAdd === 0 ? (
            <div style={{ fontSize: '14px', color: '#7fc458', marginBottom: '12px' }}>
              ✓ Nothing to add — this campaign is already in sync with the {plan.setting} seed config.
            </div>
          ) : (
            <>
              <div style={{ fontSize: '14px', color: '#cce0f5', lineHeight: 1.6, marginBottom: '12px' }}>
                Will add {plan.pinsToAdd.length} pin{plan.pinsToAdd.length === 1 ? '' : 's'}, {plan.npcsToAdd.length} NPC{plan.npcsToAdd.length === 1 ? '' : 's'}, {plan.scenesToAdd.length} scene{plan.scenesToAdd.length === 1 ? '' : 's'}, {plan.handoutsToAdd.length} handout{plan.handoutsToAdd.length === 1 ? '' : 's'}.{' '}
                <span style={{ color: '#5a5550' }}>
                  Skipped {plan.pinsSkipped + plan.npcsSkipped + plan.scenesSkipped + plan.handoutsSkipped} already-present items.
                </span>
              </div>
              <ItemList title="Pins" items={plan.pinsToAdd.map(p => p.name)} />
              <ItemList title="NPCs" items={plan.npcsToAdd.map(n => n.name)} />
              <ItemList title="Scenes" items={plan.scenesToAdd.map(s => s.name)} />
              <ItemList title="Handouts" items={plan.handoutsToAdd.map(h => h.title)} />
              <div style={{ fontSize: '13px', color: '#EF9F27', marginTop: '12px', marginBottom: '12px', lineHeight: 1.5 }}>
                ⚠ If a GM has renamed a seeded item, that item appears here as a duplicate. Verify before applying.
              </div>
              <button onClick={handleApply} disabled={applying} style={{ ...btnPrimary, opacity: applying ? 0.6 : 1 }}>
                {applying ? 'Applying…' : `Confirm — Add ${totalToAdd} Items`}
              </button>
            </>
          )}
        </div>
      )}

      {result && (
        <div style={{ ...panel, background: result.errors.length === 0 ? '#1a2e10' : '#2a1210', border: `1px solid ${result.errors.length === 0 ? '#2d5a1b' : '#7a1f16'}` }}>
          <div style={{ ...subLabel, color: result.errors.length === 0 ? '#7fc458' : '#f5a89a', marginBottom: '6px' }}>
            {result.errors.length === 0 ? 'Reseed Applied' : 'Reseed Applied With Errors'}
          </div>
          <div style={{ fontSize: '14px', color: '#f5f2ee', lineHeight: 1.6 }}>
            Added: {result.pins} pin{result.pins === 1 ? '' : 's'}, {result.npcs} NPC{result.npcs === 1 ? '' : 's'}, {result.scenes} scene{result.scenes === 1 ? '' : 's'}, {result.handouts} handout{result.handouts === 1 ? '' : 's'}.
          </div>
          {result.errors.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#f5a89a', lineHeight: 1.5, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {result.errors.join('\n')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Compact list of names for the preview. Names truncate with ellipsis on
// overflow rather than wrapping so the panel stays scan-friendly even
// with 30+ items.
function ItemList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
        {title} <span style={{ color: '#5a5550' }}>({items.length})</span>
      </div>
      <div style={{ background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px', padding: '6px 10px', maxHeight: '160px', overflowY: 'auto' }}>
        {items.map((name, i) => (
          <div key={i} style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Barlow, sans-serif', padding: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            · {name}
          </div>
        ))}
      </div>
    </div>
  )
}
