'use client'
// RestorePickerModal - GM-Tools "Restore to full health" picker. Extracted
// from page.tsx verbatim (table re-arch Step 3 lead-in - the complex,
// health-mutating leaf). Lists damaged PCs / NPCs / objects; selected rows are
// reset to full WP/RP via parallel per-row UPDATEs, with optimistic local
// patches so the bars fill instantly. Refetch + broadcast run in the
// background after the modal closes. State + setters + supabase + channelRef +
// loadEntries are threaded as props; behavior is unchanged including the
// optimistic-patch ordering, the per-table Promise.all waves, and the
// background refetch.

import { getCampaignNpcs } from '../../../../../lib/data/campaign-npcs'

interface RestorePickerModalProps {
  open: boolean
  onClose: () => void
  campaignId: string
  campaignNpcs: any[]
  entries: any[]
  restoreObjects: any[]
  mapTokens: any[]
  restoreNpcIds: Set<string>
  setRestoreNpcIds: any
  restoring: boolean
  setRestoring: any
  setCampaignNpcs: any
  setRosterNpcs: any
  setViewingNpcs: any
  setMapTokens: any
  setTokenRefreshKey: any
  supabase: any
  initChannelRef: { current: any }
  loadEntries: (campaignId: string) => Promise<any>
}

export function RestorePickerModal({
  open, onClose, campaignId, campaignNpcs, entries, restoreObjects, mapTokens,
  restoreNpcIds, setRestoreNpcIds, restoring, setRestoring,
  setCampaignNpcs, setRosterNpcs, setViewingNpcs, setMapTokens, setTokenRefreshKey,
  supabase, initChannelRef, loadEntries,
}: RestorePickerModalProps) {
  if (!open) return null
  const deadNpcs = campaignNpcs
    .map(n => {
      const wp = n.wp_current ?? n.wp_max ?? 10
      const wpMax = n.wp_max ?? 10
      const rp = n.rp_current ?? n.rp_max ?? 6
      const rpMax = n.rp_max ?? 6
      const damaged = n.status === 'dead' || wp < wpMax || rp < rpMax
      return { key: `npc:${n.id}`, name: n.name, type: n.npc_type ?? 'NPC', damaged }
    })
    .filter(d => d.damaged)
  const deadPCs = entries
    .filter(e => e.liveState && (e.liveState.wp_current < e.liveState.wp_max || e.liveState.rp_current < e.liveState.rp_max))
    .map(e => ({ key: `pc:${e.stateId}`, name: e.character.name, type: 'PC' }))
  // Objects come from restoreObjects - a fresh snapshot taken when
  // the modal opened, so they show up regardless of which view the GM
  // was on when they hit Restore.
  const damagedObjects = restoreObjects.map(t => ({ key: `obj:${t.id}`, name: t.name, type: 'OBJECT' }))
  const sections: { label: string; items: { key: string; name: string; type: string }[] }[] = [
    { label: 'Player Characters', items: deadPCs },
    { label: 'NPCs', items: deadNpcs },
    { label: 'Objects', items: damagedObjects },
  ].filter(s => s.items.length > 0)
  const allDead = [...deadPCs, ...deadNpcs, ...damagedObjects]
  const allSelected = allDead.length > 0 && allDead.every(d => restoreNpcIds.has(d.key))
  return (
    <div onClick={() => onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '1.5rem', width: '400px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '13px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>Restore</div>
        <div style={{ fontFamily: 'Carlito, sans-serif', fontSize: '18px', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#f5f2ee', marginBottom: '0.5rem' }}>Restore to full health</div>
        {allDead.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: '#888', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{restoreNpcIds.size} of {allDead.length} selected</span>
            <button onClick={() => setRestoreNpcIds(allSelected ? new Set() : new Set(allDead.map(d => d.key)))}
              style={{ padding: '2px 8px', background: allSelected ? '#2a1210' : '#1a2e10', border: `1px solid ${allSelected ? '#c0392b' : '#2d5a1b'}`, borderRadius: '3px', color: allSelected ? '#f5a89a' : '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
          {sections.length === 0 ? (
            <div style={{ color: '#cce0f5', fontSize: '13px', textAlign: 'center', padding: '1rem' }}>Nothing to restore - everyone is at full health.</div>
          ) : sections.map(section => {
            const sectionKeys = section.items.map(i => i.key)
            const sectionAllSelected = sectionKeys.every(k => restoreNpcIds.has(k))
            return (
              <div key={section.label} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '0 2px' }}>
                  <span style={{ fontSize: '13px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600 }}>{section.label} ({section.items.length})</span>
                  <button onClick={() => {
                    setRestoreNpcIds((prev: Set<string>) => {
                      const next = new Set(prev)
                      if (sectionAllSelected) sectionKeys.forEach(k => next.delete(k))
                      else sectionKeys.forEach(k => next.add(k))
                      return next
                    })
                  }}
                    style={{ padding: '1px 6px', background: 'none', border: '1px solid #2e2e2e', borderRadius: '2px', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    {sectionAllSelected ? 'None' : 'All'}
                  </button>
                </div>
                {section.items.map(d => {
                  const color = section.label === 'Player Characters' ? '#7ab3d4' : section.label === 'Objects' ? '#EF9F27' : '#f5a89a'
                  return (
                    <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: restoreNpcIds.has(d.key) ? '#1a2e10' : '#1a1a1a', border: `1px solid ${restoreNpcIds.has(d.key) ? '#2d5a1b' : '#2e2e2e'}`, borderRadius: '3px', marginBottom: '4px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={restoreNpcIds.has(d.key)} onChange={() => {
                        setRestoreNpcIds((prev: Set<string>) => { const next = new Set(prev); if (next.has(d.key)) next.delete(d.key); else next.add(d.key); return next })
                      }} style={{ accentColor: '#7fc458' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>{d.name}</div>
                        <span style={{ fontSize: '13px', color, fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>{d.type}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onClose()}
            style={{ flex: 1, padding: '10px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={async () => {
            if (restoreNpcIds.size === 0 || restoring) return
            setRestoring(true)
            const selected = Array.from(restoreNpcIds)
            const nowIso = new Date().toISOString()
            // Full reset clears every condition, not just HP: stress (PC only),
            // and the whole infection block. Without this an infected character
            // stays infection_state-flagged forever (only the day-clock clears
            // it), so the no-stacking gate skips their end-of-combat checks.
            const clearedInfection = {
              infection_state: null,
              infection_days_left: 0,
              infection_lasting_risk: false,
              infection_severity: null,
              infection_started_at: null,
              infection_infected_by: null,
              infection_pending_lasting_check: false,
            }
            // Build per-row UPDATEs - each row needs its own wp_max/rp_max
            // (NPCs have stat-derived totals; PC entries carry their own;
            // objects have per-token wp_max). Different values per row =
            // can't .in() batch into a single SQL statement. But we CAN
            // parallelize the round-trips: 11 sequential awaits at 150ms
            // RTT = ~1.6s; one Promise.all wave = ~150ms. Three table
            // groups also run in parallel since they hit different tables.
            //
            // Perceived-speed fix (2026-05-05): apply optimistic local
            // patches to campaignNpcs + entries + mapTokens BEFORE the
            // Promise.all so the WP/RP bars fill in immediately. The GM
            // sees instant feedback even if the DB round-trip is slow.
            // Refetches now run in the background AFTER the modal closes
            // - they were the actual "FOREVER" feel: loadEntries and the
            // campaign_npcs full-select were blocking the modal close.
            // Realtime subscriptions on the player side catch up the
            // same way they would for any in-flight UPDATE.
            const npcKeyToWpRp = new Map<string, { wp: number; rp: number }>()
            const npcUpdates = selected
              .filter(k => k.startsWith('npc:'))
              .map(key => {
                const npcId = key.slice(4)
                const npc = campaignNpcs.find((n: any) => n.id === npcId)
                const wpMax = npc?.wp_max ?? (10 + (npc?.physicality ?? 0) + (npc?.dexterity ?? 0))
                const rpMax = npc?.rp_max ?? (6 + (npc?.physicality ?? 0))
                npcKeyToWpRp.set(npcId, { wp: wpMax, rp: rpMax })
                return supabase.from('campaign_npcs').update({ wp_current: wpMax, rp_current: rpMax, status: 'active', death_countdown: null, incap_rounds: null, ...clearedInfection }).eq('id', npcId)
              })
            const pcKeyToWpRp = new Map<string, { wp: number; rp: number }>()
            const pcUpdates = selected
              .filter(k => k.startsWith('pc:'))
              .map(key => {
                const stateId = key.slice(3)
                const entry = entries.find(e => e.stateId === stateId)
                if (!entry) return null
                pcKeyToWpRp.set(stateId, { wp: entry.liveState.wp_max, rp: entry.liveState.rp_max })
                return supabase.from('character_states').update({ wp_current: entry.liveState.wp_max, rp_current: entry.liveState.rp_max, death_countdown: null, incap_rounds: null, stress: 0, ...clearedInfection, updated_at: nowIso }).eq('id', stateId)
              })
              .filter(Boolean) as ReturnType<typeof supabase.from>[]
            // Restore map objects (crates, barrels, etc.) to full WP. Loot
            // contents are NOT magically restored - if a player already
            // looted the crate before you destroyed and restored it, the
            // contents stay gone. Reset is just "this token is intact
            // again" so it can be destroyed a second time.
            const objKeyToWp = new Map<string, number>()
            const objUpdates = selected
              .filter(k => k.startsWith('obj:'))
              .map(key => {
                const tokenId = key.slice(4)
                const snap = restoreObjects.find(t => t.id === tokenId)
                const fromMap = mapTokens.find(t => t.id === tokenId)
                const wpMax = snap?.wp_max ?? fromMap?.wp_max
                if (wpMax == null) return null
                objKeyToWp.set(tokenId, wpMax)
                return supabase.from('scene_tokens').update({ wp_current: wpMax }).eq('id', tokenId)
              })
              .filter(Boolean) as ReturnType<typeof supabase.from>[]

            // Optimistic local patch - bars fill instantly even on slow
            // connections.
            if (npcKeyToWpRp.size > 0) {
              setCampaignNpcs((prev: any[]) => prev.map((n: any) => {
                const v = npcKeyToWpRp.get(n.id)
                return v ? { ...n, wp_current: v.wp, rp_current: v.rp, status: 'active', death_countdown: null, incap_rounds: null, ...clearedInfection } : n
              }))
              setRosterNpcs((prev: any[]) => prev.map((n: any) => {
                const v = npcKeyToWpRp.get(n.id)
                return v ? { ...n, wp_current: v.wp, rp_current: v.rp, status: 'active', death_countdown: null, incap_rounds: null, ...clearedInfection } : n
              }))
              setViewingNpcs((prev: any[]) => prev.map((n: any) => {
                const v = npcKeyToWpRp.get(n.id)
                return v ? { ...n, wp_current: v.wp, rp_current: v.rp, status: 'active', death_countdown: null, incap_rounds: null, ...clearedInfection } : n
              }))
            }
            if (objKeyToWp.size > 0) {
              setMapTokens((prev: any[]) => prev.map((t: any) => {
                const wpMax = objKeyToWp.get(t.id)
                return wpMax != null ? { ...t, wp_current: wpMax } : t
              }))
            }

            // Close the modal immediately after the writes return -
            // refetches happen in the background. If a write fails the
            // realtime subscription will correct local state on the
            // next round, and a console.error trail surfaces it.
            try {
              const results = await Promise.all([...npcUpdates, ...pcUpdates, ...objUpdates])
              const errs = results.map((r: any) => r?.error).filter(Boolean)
              if (errs.length > 0) {
                console.error('[restore] some updates failed:', errs)
                alert(`${errs.length} update${errs.length === 1 ? '' : 's'} failed during restore. Check the console for details - affected entries may need a manual restore.`)
              }
            } finally {
              onClose()
              setRestoreNpcIds(new Set())
              setRestoring(false)
            }

            // Background refetch + broadcast - runs after modal close so
            // the GM doesn't wait on these.
            ;(async () => {
              initChannelRef.current?.send({ type: 'broadcast', event: 'pc_damaged', payload: {} })
              if (objKeyToWp.size > 0) {
                setTokenRefreshKey((k: number) => k + 1)
                initChannelRef.current?.send({ type: 'broadcast', event: 'token_changed', payload: {} })
              }
              const [{ data: freshNpcs }] = await Promise.all([
                getCampaignNpcs(campaignId),
                loadEntries(campaignId),
              ])
              if (freshNpcs) {
                setCampaignNpcs(freshNpcs)
                setRosterNpcs(freshNpcs.filter((n: any) => {
                  if (n.status !== 'active') return false
                  const wp = n.wp_current ?? n.wp_max ?? 10
                  return !(wp === 0 && n.death_countdown != null && n.death_countdown <= 0)
                }))
                setViewingNpcs((prev: any[]) => prev.map((vn: any) => {
                  const fresh = freshNpcs.find((f: any) => f.id === vn.id)
                  return fresh ? { ...fresh } : vn
                }))
              }
            })()
          }}
            disabled={restoreNpcIds.size === 0 || restoring}
            style={{ flex: 1, padding: '10px', background: restoreNpcIds.size > 0 && !restoring ? '#1a2e10' : '#242424', border: `1px solid ${restoreNpcIds.size > 0 && !restoring ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: restoreNpcIds.size > 0 && !restoring ? '#7fc458' : '#3a3a3a', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: restoreNpcIds.size > 0 && !restoring ? 'pointer' : 'not-allowed' }}>
            {restoring ? 'Restoring…' : `Restore ${restoreNpcIds.size > 0 ? `(${restoreNpcIds.size})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
