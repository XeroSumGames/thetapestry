'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCachedAuth } from '../../lib/auth-cache'
import { buildCharacterFromPregen } from '../../lib/xse-schema'
import { SETTING_PREGENS, EMPTY_PREGENS, type PregenSeed } from '../../lib/setting-npcs'
import { loadApprovedPregens } from '../../lib/data/pregens'
import { createCharacterForUser } from '../../lib/data/characters'
import { assignMemberCharacter, getStoryCampaignSetting } from '../../lib/data/campaigns'

interface LibraryPregen {
  id: string
  name: string
  data: any
  portrait_url: string | null
  setting: string | null
  author_username?: string
}

export default function PregenPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnStoryId = searchParams.get('return')

  const [libraryPregens, setLibraryPregens] = useState<LibraryPregen[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [settingFilter, setSettingFilter] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await loadApprovedPregens()
      setLibraryPregens((data ?? []).map((p: any) => ({
        ...p,
        author_username: (p.profiles as any)?.username ?? 'unknown',
      })))
      setLoading(false)
    }
    load()
  }, [])

  // Build the official pregen list: if returnStoryId, we could filter by setting,
  // but without it loaded we show all. Show SETTING_PREGENS entries flat.
  const officialPregens: PregenSeed[] = useMemo(() => {
    const seen = new Set<string>()
    const all: PregenSeed[] = []
    for (const list of Object.values(SETTING_PREGENS)) {
      for (const p of list) {
        if (!seen.has(p.name)) { seen.add(p.name); all.push(p) }
      }
    }
    return all
  }, [])

  const availableSettings = useMemo(() => {
    const s = new Set<string>()
    libraryPregens.forEach(p => { if (p.setting) s.add(p.setting) })
    Object.keys(SETTING_PREGENS).forEach(k => s.add(k))
    return [...s]
  }, [libraryPregens])

  function matchesFilter(name: string, extra: string) {
    const q = search.toLowerCase()
    if (q && !name.toLowerCase().includes(q) && !extra.toLowerCase().includes(q)) return false
    return true
  }

  const filteredOfficial = officialPregens.filter(p =>
    matchesFilter(p.name, p.profession + ' ' + p.three_words) &&
    (!settingFilter || Object.entries(SETTING_PREGENS).some(([k, list]) => k === settingFilter && list.some(x => x.name === p.name)))
  )

  const filteredLibrary = libraryPregens.filter(p =>
    matchesFilter(p.name, p.data?.profession ?? '') &&
    (!settingFilter || p.setting === settingFilter)
  )

  async function useOfficialPregen(seed: PregenSeed) {
    const key = `official-${seed.name}`
    if (creating) return
    setCreating(key)
    try {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      const char = buildCharacterFromPregen(seed)
      const { data: created, error } = await createCharacterForUser(user.id, char.name, char)
      if (error || !created) return
      await maybeAssign(user.id, created.id)
    } finally {
      setCreating(null)
    }
  }

  async function useLibraryPregen(pregen: LibraryPregen) {
    if (creating) return
    setCreating(pregen.id)
    try {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      const { data: created, error } = await createCharacterForUser(user.id, pregen.name, pregen.data)
      if (error || !created) return
      await maybeAssign(user.id, created.id)
    } finally {
      setCreating(null)
    }
  }

  async function maybeAssign(userId: string, charId: string) {
    if (returnStoryId) {
      const { campaignId } = await getStoryCampaignSetting(returnStoryId)
      if (campaignId) {
        await assignMemberCharacter(campaignId, userId, charId)
      }
      router.push(`/stories/${returnStoryId}`)
    } else {
      router.push('/characters')
    }
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '2rem 1rem 4rem', fontFamily: 'Carlito, sans-serif' }}>
      <style>{`
        .pregen-card { transition: border-color .15s, transform .15s; }
        .pregen-card:hover { border-color: #c0392b !important; transform: translateY(-2px); }
        .pregen-card:hover .pregen-use-btn { background: #223d14 !important; }
        .pregen-chip:hover:not(.active) { border-color: #3a3a3a !important; color: #f5f2ee !important; }
      `}</style>

      {/* Topbar */}
      <div style={{ marginBottom: '20px' }}>
        <a href={returnStoryId ? `/stories/${returnStoryId}` : '/stories'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#f5f2ee', textTransform: 'uppercase', letterSpacing: '.08em', textDecoration: 'none' }}>
          &larr; {returnStoryId ? 'Back to story' : 'Stories'}
        </a>
      </div>

      <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#fff', marginBottom: '6px' }}>
        Pre-generated characters
      </div>
      <div style={{ fontSize: '14px', color: '#7a7068', marginBottom: '24px' }}>
        Ready-to-play survivors. Pick one to drop straight into your story, or start from the ones authored for the module you&apos;re playing.
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setSettingFilter(null)}
          className={`pregen-chip${settingFilter === null ? ' active' : ''}`}
          style={filterChip(settingFilter === null)}>
          All
        </button>
        {availableSettings.map(s => (
          <button key={s} onClick={() => setSettingFilter(settingFilter === s ? null : s)}
            className={`pregen-chip${settingFilter === s ? ' active' : ''}`}
            style={filterChip(settingFilter === s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search characters..."
          style={{ marginLeft: 'auto', padding: '7px 12px', background: '#171717', border: '1px solid #2e2e2e', borderRadius: '4px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none', minWidth: '200px' }}
        />
      </div>

      {/* Official group */}
      {filteredOfficial.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#7ab3d4', fontWeight: 700 }}>
              Official Characters
            </span>
            <span style={{ fontSize: '13px', color: '#f5f2ee' }}>{filteredOfficial.length}</span>
            <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {filteredOfficial.map(p => (
              <PregenCard
                key={p.name}
                name={p.name}
                subtitle={p.profession}
                blurb={p.three_words}
                portraitUrl={null}
                isCreating={creating === `official-${p.name}`}
                onUse={() => useOfficialPregen(p)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Community group */}
      {loading && <div style={{ fontSize: '13px', color: '#cce0f5' }}>Loading community pregens...</div>}
      {!loading && filteredLibrary.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#7ab3d4', fontWeight: 700 }}>
              Community Library
            </span>
            <span style={{ fontSize: '13px', color: '#f5f2ee' }}>{filteredLibrary.length}</span>
            <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {filteredLibrary.map(p => (
              <PregenCard
                key={p.id}
                name={p.name}
                subtitle={p.data?.profession ?? ''}
                blurb={p.data?.three_words ?? ''}
                portraitUrl={p.portrait_url}
                isCreating={creating === p.id}
                onUse={() => useLibraryPregen(p)}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && filteredOfficial.length === 0 && filteredLibrary.length === 0 && (
        <div style={{ fontSize: '14px', color: '#cce0f5', padding: '2rem', textAlign: 'center' }}>
          No pregens match your filters.
        </div>
      )}
    </div>
  )
}

function PregenCard({ name, subtitle, blurb, portraitUrl, isCreating, onUse }: {
  name: string; subtitle: string; blurb: string; portraitUrl: string | null
  isCreating: boolean; onUse: () => void
}) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="pregen-card" style={{ background: '#141414', border: '1px solid #222', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ width: '100%', height: '130px', background: '#0d0d0d', position: 'relative', overflow: 'hidden' }}>
        {portraitUrl ? (
          <img src={portraitUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '38px', fontWeight: 700, color: '#2d5a1b', background: '#11180c' }}>
            {initials}
          </div>
        )}
        <span style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '13px', padding: '2px 7px', borderRadius: '3px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, background: 'rgba(0,0,0,.6)', color: '#7fc458' }}>Common</span>
      </div>
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '.02em' }}>{name}</div>
        {subtitle && <div style={{ fontSize: '13px', color: '#7ab3d4', marginTop: '2px' }}>{subtitle}</div>}
        {blurb && <div style={{ fontSize: '13px', color: '#6a635c', marginTop: '7px', lineHeight: 1.45, flex: 1 }}>{blurb}</div>}
        <button onClick={onUse} disabled={isCreating} className="pregen-use-btn"
          style={{ marginTop: '10px', padding: '7px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '4px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: isCreating ? 'not-allowed' : 'pointer', opacity: isCreating ? 0.6 : 1 }}>
          {isCreating ? 'Creating...' : 'Use this character'}
        </button>
      </div>
    </div>
  )
}

function filterChip(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', background: active ? '#2a1210' : '#171717',
    border: `1px solid ${active ? '#c0392b' : '#2e2e2e'}`,
    borderRadius: '16px', color: active ? '#f5a89a' : '#7a7068',
    fontSize: '13px', fontFamily: 'Carlito, sans-serif',
    letterSpacing: '.04em', cursor: 'pointer',
  }
}
