'use client'
// The PINS panel, lifted verbatim out of components/MapView.tsx (Phase 0.3,
// tasks/plan-one-frame-new-pages-2026-09-15.md) so the new /v2 frame can put it
// in a rail. MapView was sitting EXACTLY on its LOC ceiling (2137/2137), so
// this extraction is what buys the headroom for the rest of the work.
//
// The JSX below is a byte-for-byte slice of what MapView rendered. Every prop
// is named exactly as the local it replaced, which is why the markup compiles
// unchanged - that is the whole point. If you rename a prop here, you are no
// longer able to claim this renders identically.
//
// STATE STAYS IN MapView, deliberately. A rail will eventually want to own this
// panel independently, which means lifting the state into a shared container -
// but doing that on a file at its ceiling, in the same commit as a 456-line
// move, would make "nothing changed" unverifiable. Phase 1.2 lifts it when the
// frame exists and there is a second real consumer to shape the seam.
//
// LAYOUT COUPLING worth knowing before anyone moves this: the panel is a
// fixed-width (300px) flexShrink-0 sibling of the map canvas, which is flex:1.
// Rendering it anywhere other than that flex row makes the canvas 300px wider.
// MapView also hard-codes `right: sidebarOpen ? '306px' : '6px'` for its own
// control column and calls map.invalidateSize() on sidebarOpen, so a rail
// placement needs an equivalent resize trigger or Leaflet renders stale.
import type { Dispatch, SetStateAction } from 'react'
import { isThriver as roleIsThriver } from '../lib/auth/roles'
import { TIMELINE_STEP_MS, type Pin } from '../lib/map-pins'
import { RailTabs } from './Frame'
import { PIN_CATEGORIES, getCategoryFilter } from '../lib/pin-categories'
import { LABEL_STYLE_TIGHT } from '../lib/style-helpers'
import { bumpPinViewCount, listPinAttachments, pinAttachmentPublicUrl } from '../lib/data/map'

export interface PinsPanelProps {
  setSidebarOpen: (v: boolean) => void
  sidebarTab: any
  setSidebarTab: (v: any) => void
  userId: string | null
  userRole: any
  pins: any[]
  usernames: Record<string, string>
  thriverUserIds: Set<string>
  worldCommunities: any[]
  campaignPins: any[]
  hiddenFolders: Set<string>
  setHiddenFolders: Dispatch<SetStateAction<Set<string>>>
  pinSearch: string
  setPinSearch: (v: string) => void
  sortMode: any
  expandedPinId: string | null
  setExpandedPinId: Dispatch<SetStateAction<any>>
  pinAttachments: Record<string, { name: string; url: string }[]>
  setPinAttachments: Dispatch<SetStateAction<Record<string, { name: string; url: string }[]>>>
  expandedFolders: Set<string>
  setExpandedFolders: Dispatch<SetStateAction<Set<string>>>
  collapsedCampaigns: Set<string>
  setCollapsedCampaigns: Dispatch<SetStateAction<Set<string>>>
  timelinePlaying: boolean
  playTimeline: (...a: any[]) => void
  stopTimeline: (...a: any[]) => void
  whispers: any[]
  whisperDraft: string
  setWhisperDraft: (v: string) => void
  postingWhisper: boolean
  postWhisper: (...a: any[]) => void
  deletingWhisperId: string | null
  deleteWhisper: (...a: any[]) => void
  flyToPin: (...a: any[]) => void
  startEdit: (...a: any[]) => void
  handleDeletePin: (...a: any[]) => void
  handleTogglePublic: (...a: any[]) => void
  displayedPins: any[]
  timelineOnly: boolean
  mapInstanceRef: any
  markersRef: any
  getCategoryEmoji: (c: string) => string
  /**
   * Rendered into a frame rail rather than as the map's flex sibling. The
   * inline placement hardcodes 300px and a left border because it sits beside
   * the canvas; a rail is 260px and supplies its own edge, so both would be
   * wrong there.
   */
  inRail?: boolean
}

export default function PinsPanel({
  setSidebarOpen, sidebarTab, setSidebarTab, userId, userRole, pins, usernames,
  thriverUserIds, worldCommunities, campaignPins, hiddenFolders, setHiddenFolders,
  pinSearch, setPinSearch, sortMode, expandedPinId, setExpandedPinId,
  pinAttachments, setPinAttachments, expandedFolders, setExpandedFolders,
  collapsedCampaigns, setCollapsedCampaigns, timelinePlaying, playTimeline,
  stopTimeline, whispers, whisperDraft, setWhisperDraft, postingWhisper,
  postWhisper, deletingWhisperId, deleteWhisper, flyToPin, startEdit,
  handleDeletePin, handleTogglePublic, displayedPins, timelineOnly,
  mapInstanceRef, markersRef, getCategoryEmoji, inRail = false,
}: PinsPanelProps) {
  return (
          <div style={inRail
            ? { width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }
            : { width: '300px', flexShrink: 0, background: '#1a1a1a', borderLeft: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', zIndex: 500 }}>
            {/* Search + regions header */}
            <div style={{ padding: '8px', borderBottom: '1px solid #2e2e2e' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                {/* Closing means "slide the panel off the map", which only has a
                    meaning when the panel IS on the map. In a rail the panel is
                    the rail, so there is nothing to close - and the portal makes
                    the click inert while the hover still lights up, i.e. a
                    control that looks live and does nothing. Hidden instead. */}
                {!inRail && (
                  <button onClick={() => setSidebarOpen(false)}
                    style={{ padding: '2px 6px', background: 'none', border: 'none', color: '#3a3a3a', fontSize: '14px', cursor: 'pointer', lineHeight: 1, marginRight: '4px' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f5a89a')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#3a3a3a')}>✕</button>
                )}
                <span style={{ ...LABEL_STYLE_TIGHT }}>Pins</span>
                <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>{displayedPins.length} total</span>
              </div>
              {!userId && (
                <div onClick={() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tapestry-ghost-wall')) }}
                  style={{ marginBottom: '6px', fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', cursor: 'pointer', fontStyle: 'italic' }}>
                  Sign up to add your own story to this world.
                </div>
              )}
            </div>
            {/* Tabs */}
            {/* IN A RAIL, USE THE HOUSE RAIL-TAB DEVICE. These were bare buttons
                with no role="tab" and no aria-selected, so assistive tech saw
                three unlabelled controls and could not report which was active -
                an accessibility defect independent of any layout standard, and
                the reason this changed. Adopting RailTabs also stops a rail panel
                inventing its own tab device (which quietly opts out of the shared
                frame) and brings the height to the standard's 28px for free.

                INLINE IS UNTOUCHED, byte for byte, including the data-tour hooks
                the onboarding tour targets - the old /map and /dashboard must not
                move. Same gate-on-inRail pattern as SiteNav's variant and the
                hidden close button. */}
            {userId && inRail && (
              <div className="pinsrailtabs">
                <RailTabs
                  tabs={[
                    { id: 'public', label: 'World Events' },
                    { id: 'mine', label: 'My Pins' },
                    { id: 'whispers', label: 'Whispers' },
                  ]}
                  active={sidebarTab}
                  onPick={id => setSidebarTab(id as any)}
                />
              </div>
            )}
            {userId && !inRail && (
              <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e' }}>
                {(['public', 'mine', 'whispers'] as const).map(tab => (
                  <button key={tab} onClick={() => setSidebarTab(tab)} data-tour={tab === 'public' ? 'world' : tab === 'mine' ? 'pins' : tab === 'whispers' ? 'whispers' : undefined}
                    style={{ flex: 1, padding: '6px 2px', background: sidebarTab === tab ? '#242424' : 'transparent', border: 'none', borderBottom: sidebarTab === tab ? '2px solid #c0392b' : '2px solid transparent', color: sidebarTab === tab ? '#f5f2ee' : '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                    {tab === 'public' ? 'World Events' : tab === 'mine' ? 'My Pins' : 'Whispers'}
                  </button>
                ))}
              </div>
            )}
            {/* Search - sits under the tabs so it reads as filtering the
                list below it rather than the map header above it. */}
            <div style={{ position: 'relative', padding: '6px 10px', borderBottom: '1px solid #2e2e2e' }}>
              <input value={pinSearch} onChange={e => setPinSearch(e.target.value)} placeholder="Search pins..."
                style={{ width: '100%', padding: '5px 8px', paddingRight: pinSearch ? '26px' : '8px', background: '#242424', border: '1px solid #3a3a3a', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              {pinSearch && (
                <button onClick={() => setPinSearch('')} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#5a5a5a', cursor: 'pointer', fontSize: '13px', lineHeight: 1, padding: '0 2px' }}>✕</button>
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {sidebarTab === 'whispers' ? (
                /* Whispers - public message wall. Compose at top, list
                    below, newest first. Thrivers see an X next to each
                    row to hard-delete. */
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <textarea
                      value={whisperDraft}
                      onChange={e => setWhisperDraft(e.target.value.slice(0, 500))}
                      placeholder="Whisper into the dark... (max 500 chars)"
                      rows={3}
                      style={{ width: '100%', padding: '6px 8px', background: '#0f0f0f', border: '1px solid #2e2e2e', borderRadius: '3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5, resize: 'vertical', boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>{whisperDraft.length}/500</span>
                      <button onClick={postWhisper} disabled={postingWhisper || !whisperDraft.trim()}
                        style={{ padding: '4px 12px', background: whisperDraft.trim() ? '#1a2e10' : '#242424', border: `1px solid ${whisperDraft.trim() ? '#2d5a1b' : '#3a3a3a'}`, borderRadius: '3px', color: whisperDraft.trim() ? '#7fc458' : '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: postingWhisper ? 'wait' : whisperDraft.trim() ? 'pointer' : 'not-allowed' }}>
                        {postingWhisper ? '…' : 'Whisper'}
                      </button>
                    </div>
                  </div>
                  {whispers.length === 0 ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      No whispers yet
                    </div>
                  ) : (
                    whispers.map(w => (
                      <div key={w.id} style={{ padding: '8px 0', borderBottom: '1px solid #2e2e2e', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                            <span style={{ fontSize: '13px', color: w.author_user_id === userId ? '#7fc458' : '#cce0f5', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700 }}>
                              {w.author_username ?? '?'}
                            </span>
                            <span title={new Date(w.created_at).toLocaleString()} style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif' }}>
                              {(() => { const ms = Date.now() - new Date(w.created_at).getTime(); const m = Math.floor(ms / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; const d = Math.floor(h / 24); return `${d}d` })()}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {w.content}
                          </div>
                        </div>
                        {roleIsThriver(userRole) && (
                          <button onClick={() => { if (confirm('Delete this whisper?')) deleteWhisper(w.id) }} disabled={deletingWhisperId === w.id}
                            title="Thriver: delete this whisper"
                            style={{ flexShrink: 0, width: 22, height: 22, padding: 0, background: 'transparent', border: '1px solid #3a3a3a', borderRadius: 3, color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', cursor: deletingWhisperId === w.id ? 'wait' : 'pointer', lineHeight: 1 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2a1210'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#c0392b'; (e.currentTarget as HTMLButtonElement).style.color = '#f5a89a' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#3a3a3a'; (e.currentTarget as HTMLButtonElement).style.color = '#cce0f5' }}>
                            ×
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
              <>
              {/* Campaign-shared pins, grouped by campaign. Merged into the
                  My Pins tab (2026-08-08) - they used to have their own tab.
                  Rendered above the user's own folder tree, and only when
                  there are any, so the tab looks unchanged for solo players. */}
              {sidebarTab === 'mine' && campaignPins.length > 0 && (
                  (() => {
                    const byCampaign: Record<string, typeof campaignPins> = {}
                    for (const p of campaignPins) {
                      if (!byCampaign[p.campaign_name]) byCampaign[p.campaign_name] = []
                      byCampaign[p.campaign_name].push(p)
                    }
                    return Object.entries(byCampaign).map(([name, cPins]) => {
                      const cOpen = !collapsedCampaigns.has(name)
                      return (
                      <div key={name}>
                        <div onClick={() => {
                          setCollapsedCampaigns(prev => {
                            const next = new Set(prev)
                            next.has(name) ? next.delete(name) : next.add(name)
                            if (typeof window !== 'undefined') localStorage.setItem('tapestry_collapsed_campaigns', JSON.stringify([...next]))
                            return next
                          })
                        }}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid #2e2e2e', fontSize: '13px', color: '#c0392b', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', fontWeight: 700 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span style={{ fontSize: '13px', width: '12px', textAlign: 'center' }}>{cOpen ? '▼' : '▶'}</span>
                          <span style={{ flex: 1 }}>{name}</span>
                          <span style={{ color: '#f5f2ee', fontWeight: 400 }}>{cPins.length}</span>
                        </div>
                        {cOpen && cPins.map(p => (
                          <div key={p.id} onClick={() => {
                            if (expandedPinId === p.id) setExpandedPinId(null)
                            else { setExpandedPinId(p.id); flyToPin({ lat: p.lat, lng: p.lng, category: p.category } as any) }
                          }}
                            style={{ padding: '4px 10px 4px 20px', cursor: 'pointer', borderLeft: `2px solid ${expandedPinId === p.id ? '#c0392b' : 'transparent'}`, background: expandedPinId === p.id ? '#1a1a1a' : 'transparent' }}
                            onMouseEnter={e => { if (expandedPinId !== p.id) e.currentTarget.style.background = '#1a1a1a' }}
                            onMouseLeave={e => { if (expandedPinId !== p.id) e.currentTarget.style.background = 'transparent' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '14px', ...(() => { const f = getCategoryFilter(p.category); return f ? { filter: f, display: 'inline-block' } : {} })() }}>{getCategoryEmoji(p.category)}</span>
                              <span style={{ fontSize: '13px', color: '#f5f2ee', overflow: expandedPinId === p.id ? 'visible' : 'hidden', textOverflow: 'ellipsis', whiteSpace: expandedPinId === p.id ? 'normal' : 'nowrap' }}>{p.name}</span>
                            </div>
                            {expandedPinId === p.id && p.notes && (
                              <div style={{ fontSize: '13px', color: '#f5f2ee', lineHeight: 1.5, marginTop: '4px', paddingLeft: '20px' }}>{p.notes}</div>
                            )}
                          </div>
                        ))}
                      </div>
                      )
                    })
                  })()
              )}
              {/* World Events / My Pins folder tree */}
              {(() => {
                // Group displayed pins by category - pins with multiple categories appear in multiple folders
                const folderMap: Record<string, Pin[]> = {}
                for (const p of displayedPins) {
                  const rawCats = p.categories
                  const cats: string[] = Array.isArray(rawCats) && rawCats.length > 0 ? rawCats.map(String) : [p.category ?? 'location']
                  for (const cat of cats) {
                    if (!folderMap[cat]) folderMap[cat] = []
                    folderMap[cat].push(p)
                  }
                }
                // Sort within each folder: timeline by sort_order, others by name
                for (const cat of Object.keys(folderMap)) {
                  if (cat === 'world_event') {
                    folderMap[cat].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
                  } else {
                    folderMap[cat].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
                  }
                  // Parent/child interleave - when a pin's parent_pin_id
                  // points to another pin in this same folder, render the
                  // child directly under its parent (and indent it in the
                  // row markup). Children whose parent isn't in this
                  // folder render at top-level alongside everyone else.
                  const arr = folderMap[cat]
                  const idsInFolder = new Set(arr.map(p => p.id))
                  const childrenByParent: Record<string, Pin[]> = {}
                  const topLevel: Pin[] = []
                  for (const p of arr) {
                    const parent = (p as any).parent_pin_id as string | null | undefined
                    if (parent && idsInFolder.has(parent)) {
                      if (!childrenByParent[parent]) childrenByParent[parent] = []
                      childrenByParent[parent].push(p)
                    } else {
                      topLevel.push(p)
                    }
                  }
                  const reordered: Pin[] = []
                  for (const p of topLevel) {
                    reordered.push(p)
                    const kids = childrenByParent[p.id]
                    if (kids) reordered.push(...kids)
                  }
                  folderMap[cat] = reordered
                }
                // Sort categories: Distemper Timeline first, then the rest in PIN_CATEGORIES order
                const sortedCats = PIN_CATEGORIES.filter(c => folderMap[c.value] && folderMap[c.value].length > 0)
                  .sort((a, b) => a.value === 'world_event' ? -1 : b.value === 'world_event' ? 1 : 0)
                // Phase E - synthetic "🌐 Published Communities" folder.
                // Sits above the normal PIN_CATEGORIES folders because
                // it's a distinct layer, not a pin category. Filtered
                // by pinSearch against name or campaign name.
                const searchLC = pinSearch.trim().toLowerCase()
                const wcFiltered = worldCommunities
                  .filter(wc => !searchLC
                    || wc.name.toLowerCase().includes(searchLC)
                    || wc.campaign_name.toLowerCase().includes(searchLC)
                    || (wc.faction_label ?? '').toLowerCase().includes(searchLC))
                  .sort((a, b) => a.name.localeCompare(b.name))
                const wcFolderHasContent = wcFiltered.length > 0
                if (sortedCats.length === 0 && !wcFolderHasContent) {
                  return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '13px', color: '#cce0f5' }}>{pinSearch.trim() ? 'No pins match your search.' : 'No pins to display.'}</div>
                }
                // If searching, auto-expand all folders with matches
                const isSearching = pinSearch.trim().length > 0
                const wcFolderOpen = isSearching || expandedFolders.has('world_community')
                const wcHidden = hiddenFolders.has('world_community')
                const wcFolderNode = wcFolderHasContent ? (
                  <div key="world_community_folder" style={{ opacity: wcHidden ? 0.4 : 1 }}>
                    <div onClick={() => {
                      setExpandedFolders(prev => {
                        const next = new Set(prev)
                        next.has('world_community') ? next.delete('world_community') : next.add('world_community')
                        if (typeof window !== 'undefined') localStorage.setItem('tapestry_folder_state', JSON.stringify([...next]))
                        return next
                      })
                    }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #2e2e2e', userSelect: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: '13px', color: '#f5f2ee', width: '12px', textAlign: 'center' }}>{wcFolderOpen ? '▼' : '▶'}</span>
                      <span style={{ fontSize: '14px' }}>🌐</span>
                      <span style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1, fontWeight: 600 }}>Player Communities</span>
                      <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginRight: '4px' }}>{wcFiltered.length}</span>
                      <span onClick={e => {
                        e.stopPropagation()
                        setHiddenFolders(prev => {
                          const next = new Set(prev)
                          next.has('world_community') ? next.delete('world_community') : next.add('world_community')
                          if (typeof window !== 'undefined') localStorage.setItem('tapestry_hidden_folders', JSON.stringify([...next]))
                          return next
                        })
                      }}
                        title={wcHidden ? 'Show on map' : 'Hide from map'}
                        style={{ fontSize: '13px', cursor: 'pointer', color: wcHidden ? '#f5f2ee' : '#7fc458', lineHeight: 1 }}>
                        {wcHidden ? '👁‍🗨' : '👁'}
                      </span>
                    </div>
                    {wcFolderOpen && (
                      <div style={{ padding: '2px 0 4px' }}>
                        {wcFiltered.map(wc => {
                          // Status-tier dot color - mirrors the map
                          // marker palette so players recognize the
                          // community in both surfaces.
                          const color = wc.community_status === 'Thriving' ? '#7fc458'
                            : wc.community_status === 'Holding' ? '#cce0f5'
                            : wc.community_status === 'Struggling' ? '#EF9F27'
                            : wc.community_status === 'Dying' ? '#f5a89a'
                            : '#f5f2ee'
                          return (
                            <div key={wc.id}
                              onClick={() => {
                                const map = mapInstanceRef.current
                                if (!map) return
                                map.flyTo([wc.lat, wc.lng], 11, { duration: 1.2 })
                                const marker = markersRef.current[`world_community:${wc.id}`]
                                if (marker) setTimeout(() => marker.openPopup(), 1300)
                              }}
                              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 6px 30px', cursor: 'pointer', fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#1a1a2e')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              title={`${wc.name} · ${wc.size_band} · ${wc.community_status}${wc.faction_label ? ' · ' + wc.faction_label : ''} · From ${wc.campaign_name}`}>
                              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, border: '1px solid #1a1a1a', flexShrink: 0 }} />
                              <span style={{ color: '#f5f2ee', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wc.name}</span>
                              <span style={{ color: '#f5f2ee', fontSize: '13px', letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0 }}>{wc.size_band}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ) : null
                return (
                  <>
                    {wcFolderNode}
                    {sortedCats.map(cat => {
                  const folderPins = folderMap[cat.value] ?? []
                  const isOpen = isSearching || expandedFolders.has(cat.value)
                  const isHidden = hiddenFolders.has(cat.value)
                  return (
                    <div key={cat.value} style={{ opacity: isHidden ? 0.4 : 1 }}>
                      <div onClick={() => {
                        setExpandedFolders(prev => {
                          const next = new Set(prev)
                          next.has(cat.value) ? next.delete(cat.value) : next.add(cat.value)
                          if (typeof window !== 'undefined') localStorage.setItem('tapestry_folder_state', JSON.stringify([...next]))
                          return next
                        })
                      }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #2e2e2e', userSelect: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <span style={{ fontSize: '13px', color: '#f5f2ee', width: '12px', textAlign: 'center' }}>{isOpen ? '▼' : '▶'}</span>
                        <span style={{ fontSize: '14px' }}>{cat.emoji}</span>
                        <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', flex: 1 }}>{cat.label}</span>
                        <span style={{ fontSize: '13px', color: '#f5f2ee', fontFamily: 'Carlito, sans-serif', marginRight: '4px' }}>{folderPins.length}</span>
                        {cat.value === 'world_event' && folderPins.length > 0 && (
                          <span onClick={e => {
                            e.stopPropagation()
                            if (timelinePlaying) { stopTimeline(); return }
                            // Open the folder so the rows highlight as it walks
                            setExpandedFolders(prev => {
                              const next = new Set(prev)
                              next.add(cat.value)
                              if (typeof window !== 'undefined') localStorage.setItem('tapestry_folder_state', JSON.stringify([...next]))
                              return next
                            })
                            playTimeline(folderPins)
                          }}
                            title={timelinePlaying ? 'Stop the timeline walkthrough' : `Play the timeline - ${Math.round(TIMELINE_STEP_MS / 1000)}s per event`}
                            style={{ fontSize: '13px', cursor: 'pointer', color: timelinePlaying ? '#c0392b' : '#7fc458', lineHeight: 1, marginRight: '6px' }}>
                            {timelinePlaying ? '■' : '▶'}
                          </span>
                        )}
                        <span onClick={e => {
                          e.stopPropagation()
                          setHiddenFolders(prev => {
                            const next = new Set(prev)
                            next.has(cat.value) ? next.delete(cat.value) : next.add(cat.value)
                            if (typeof window !== 'undefined') localStorage.setItem('tapestry_hidden_folders', JSON.stringify([...next]))
                            return next
                          })
                        }}
                          title={isHidden ? 'Show on map' : 'Hide from map'}
                          style={{ fontSize: '13px', cursor: 'pointer', color: isHidden ? '#f5f2ee' : '#7fc458', lineHeight: 1 }}>
                          {isHidden ? '👁‍🗨' : '👁'}
                        </span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: '2px 0 4px' }}>
                          {(() => {
                            // Build a quick lookup so child rows can detect
                            // they're siblings of a parent in this folder
                            // and pick up the indent treatment.
                            const folderIds = new Set(folderPins.map(p => p.id))
                            return folderPins.map(p => {
                              const isExpanded = expandedPinId === p.id
                              const parentId = (p as any).parent_pin_id as string | null | undefined
                              const isChild = !!parentId && folderIds.has(parentId)
                              return (
                                <div key={p.id} onClick={() => {
                                  if (isExpanded) { setExpandedPinId(null) }
                                  else {
                                    setExpandedPinId(p.id); flyToPin(p)
                                    bumpPinViewCount(p.id, (p as any).view_count ?? 0)
                                    if (!pinAttachments[p.id]) {
                                      listPinAttachments(`${p.user_id}/${p.id}`).then(({ data: files }: any) => {
                                        if (files && files.length > 0) {
                                          const atts = files.map((f: any) => {
                                            const { data: urlData } = pinAttachmentPublicUrl(`${p.user_id}/${p.id}/${f.name}`)
                                            return { name: f.name, url: urlData.publicUrl }
                                          })
                                          setPinAttachments(prev => ({ ...prev, [p.id]: atts }))
                                        } else {
                                          setPinAttachments(prev => ({ ...prev, [p.id]: [] }))
                                        }
                                      })
                                    }
                                  }
                                }}
                                  style={{ padding: isChild ? '4px 10px 4px 50px' : '4px 10px 4px 34px', cursor: 'pointer', borderLeft: `2px solid ${isExpanded ? '#c0392b' : 'transparent'}`, background: isExpanded ? '#1a1a1a' : 'transparent' }}
                                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = '#1a1a1a' }}
                                  onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}>
                                  <div style={{ fontSize: '13px', color: '#f5f2ee', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: 'ellipsis', whiteSpace: isExpanded ? 'normal' : 'nowrap' }}>
                                    {isChild && <span style={{ color: '#f5f2ee', marginRight: '4px' }}>↳</span>}
                                    {p.title}
                                  {isExpanded && p.user_id && thriverUserIds.has(p.user_id) && (
                                    <span title="Canon - published by The Tapestry team" style={{ marginLeft: '6px', padding: '1px 6px', background: '#2a2010', border: '1px solid #EF9F27', borderRadius: '2px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                                      🛡️ Canon
                                    </span>
                                  )}
                                </div>
                                {isExpanded && (
                                  <div style={{ marginTop: '4px' }}>
                                    {/* Parent breadcrumb - surfaces the parent
                                        pin's title when this pin is nested.
                                        Click jumps to the parent (expand it +
                                        flyTo). Lookup is against `pins`, so
                                        cross-folder parents still resolve. */}
                                    {(() => {
                                      const parentId = (p as any).parent_pin_id as string | null | undefined
                                      if (!parentId) return null
                                      const parent = pins.find(x => x.id === parentId)
                                      if (!parent) return null
                                      return (
                                        <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>
                                          Sub-pin of <button onClick={e => { e.stopPropagation(); setExpandedPinId(parent.id); flyToPin(parent) }}
                                            style={{ background: 'none', border: 'none', color: '#7ab3d4', cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '13px', fontFamily: 'Carlito, sans-serif' }}>
                                            {parent.title}
                                          </button>
                                        </div>
                                      )
                                    })()}
                                    {p.notes && <div style={{ fontSize: '13px', color: '#f5f2ee', lineHeight: 1.5, marginBottom: '6px' }}>{p.notes}</div>}
                                    <div style={{ fontSize: '13px', color: '#cce0f5', fontFamily: 'Carlito, sans-serif', marginBottom: '4px' }}>
                                      {p.category === 'world_event'
                                        ? (p.event_date ? <span style={{ color: '#EF9F27' }}>{p.event_date}</span> : '')
                                        : <>{usernames[p.user_id] ? `By ${usernames[p.user_id]}` : ''}</>
                                      }
                                    </div>
                                    {pinAttachments[p.id] && pinAttachments[p.id].length > 0 && (
                                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #2e2e2e' }}>
                                        {pinAttachments[p.id].map(att => {
                                          const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name)
                                          return isImage ? (
                                            <a key={att.name} href={att.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                                              <img src={att.url} alt={att.name} style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '3px', marginBottom: '4px', border: '1px solid #2e2e2e', background: '#0a0a0a' }} />
                                            </a>
                                          ) : (
                                            <a key={att.name} href={att.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                                              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#7ab3d4', textDecoration: 'none', marginBottom: '3px' }}>
                                              📎 {att.name}
                                            </a>
                                          )
                                        })}
                                      </div>
                                    )}
                                    {(p.user_id === userId || roleIsThriver(userRole)) && (
                                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                        {roleIsThriver(userRole) && (
                                          <button onClick={e => { e.stopPropagation(); handleTogglePublic(p) }}
                                            style={{ background: 'none', border: 'none', color: p.status === 'approved' ? '#7fc458' : '#cce0f5', cursor: 'pointer', fontSize: '13px', padding: '0', fontFamily: 'Carlito, sans-serif' }}>
                                            {p.status === 'approved' ? 'Public' : 'Private'}
                                          </button>
                                        )}
                                        <button onClick={e => { e.stopPropagation(); startEdit(p) }}
                                          style={{ background: 'none', border: 'none', color: '#f5f2ee', cursor: 'pointer', fontSize: '13px', padding: '0', fontFamily: 'Carlito, sans-serif' }}>Edit</button>
                                        <button onClick={e => { e.stopPropagation(); if (confirm('Delete this pin?')) handleDeletePin(p.id) }}
                                          style={{ background: 'none', border: 'none', color: '#f5a89a', cursor: 'pointer', fontSize: '13px', padding: '0' }}>×</button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                </div>
                              )
                            })
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
                  </>
                )
              })()}
              </>
              )}
            </div>
          </div>
  )
}
