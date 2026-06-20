'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCachedAuth } from '../../lib/auth-cache'
import { loadOfficialPregens, loadApprovedPregens } from '../../lib/data/pregens'
import { createCharacterForUser } from '../../lib/data/characters'
import { assignMemberCharacter, getStoryCampaignSetting, getUserRole } from '../../lib/data/campaigns'
import { isThriver as roleIsThriver } from '../../lib/auth/roles'

interface DBPregen {
  id: string
  name: string
  data: any
  portrait_url: string | null
  setting: string | null
  author_id?: string | null
  author_username?: string
}

export default function PregenPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnStoryId = searchParams.get('return')

  const [officialPregens, setOfficialPregens] = useState<DBPregen[]>([])
  const [libraryPregens, setLibraryPregens] = useState<DBPregen[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [settingFilter, setSettingFilter] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isThriverUser, setIsThriverUser] = useState(false)
  const [storySetting, setStorySetting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (user) {
        setUserId(user.id)
        const { data: prof } = await getUserRole(user.id)
        setIsThriverUser(roleIsThriver(prof))
      }
      const [offRes, libRes] = await Promise.all([loadOfficialPregens(), loadApprovedPregens()])
      setOfficialPregens((offRes.data ?? []) as DBPregen[])
      setLibraryPregens((libRes.data ?? []).map((p: any) => ({
        ...p,
        author_username: (p.profiles as any)?.username ?? 'unknown',
      })))

      if (returnStoryId) {
        const { setting } = await getStoryCampaignSetting(returnStoryId)
        if (setting) {
          setStorySetting(setting)
          setSettingFilter(setting)
        }
      }

      setLoading(false)
    }
    load()
  }, [returnStoryId])

  const allPregens = useMemo(() => [...officialPregens, ...libraryPregens], [officialPregens, libraryPregens])

  const availableSettings = useMemo(() => {
    const s = new Set<string>()
    allPregens.forEach(p => { if (p.setting) s.add(p.setting) })
    return [...s].sort()
  }, [allPregens])

  const filteredPregens = useMemo(() => {
    const q = search.toLowerCase()
    return allPregens.filter(p => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.data?.profession ?? '').toLowerCase().includes(q)
      const matchesSetting = !settingFilter || p.setting === settingFilter
      return matchesSearch && matchesSetting
    })
  }, [allPregens, search, settingFilter])

  const pregensWithSetting = useMemo(() =>
    availableSettings
      .map(s => ({ setting: s, pregens: filteredPregens.filter(p => p.setting === s) }))
      .filter(g => g.pregens.length > 0),
    [availableSettings, filteredPregens]
  )

  const pregensNoSetting = useMemo(() =>
    filteredPregens.filter(p => !p.setting),
    [filteredPregens]
  )

  async function usePregen(pregen: DBPregen) {
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
      if (campaignId) await assignMemberCharacter(campaignId, userId, charId)
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
        {storySetting && (
          <button onClick={() => setSettingFilter(storySetting)}
            className={`pregen-chip${settingFilter === storySetting ? ' active' : ''}`}
            style={filterChip(settingFilter === storySetting)}>
            For this story
          </button>
        )}
        {availableSettings.filter(s => s !== storySetting).map(s => (
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

      {loading && <div style={{ fontSize: '13px', color: '#cce0f5' }}>Loading...</div>}

      {/* Setting-grouped sections */}
      {pregensWithSetting.map(group => (
        <div key={group.setting} style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#7ab3d4', fontWeight: 700 }}>
              {storySetting && group.setting === storySetting ? '★ ' : ''}Authored for &ldquo;{group.setting.charAt(0).toUpperCase() + group.setting.slice(1)}&rdquo;
            </span>
            <span style={{ fontSize: '13px', color: '#5a5a5a' }}>{group.pregens.length} {group.pregens.length === 1 ? 'character' : 'characters'}</span>
            <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {group.pregens.map(p => (
              <PregenCard
                key={p.id}
                name={p.name}
                subtitle={p.data?.profession ?? ''}
                blurb={Array.isArray(p.data?.threeWords) ? p.data.threeWords.join(', ') : (p.data?.threeWords ?? '')}
                portraitUrl={p.portrait_url}
                setting={p.setting}
                isCreating={creating === p.id}
                onUse={() => usePregen(p)}
                editHref={(isThriverUser || p.author_id === userId) ? `/pregens/${p.id}/edit` : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      {/* General library - pregens with no setting */}
      {pregensNoSetting.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#7ab3d4', fontWeight: 700 }}>
              General Library
            </span>
            <span style={{ fontSize: '13px', color: '#5a5a5a' }}>{pregensNoSetting.length} {pregensNoSetting.length === 1 ? 'character' : 'characters'}</span>
            <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {pregensNoSetting.map(p => (
              <PregenCard
                key={p.id}
                name={p.name}
                subtitle={p.data?.profession ?? ''}
                blurb={Array.isArray(p.data?.threeWords) ? p.data.threeWords.join(', ') : (p.data?.threeWords ?? '')}
                portraitUrl={p.portrait_url}
                setting={null}
                isCreating={creating === p.id}
                onUse={() => usePregen(p)}
                editHref={(isThriverUser || p.author_id === userId) ? `/pregens/${p.id}/edit` : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && pregensWithSetting.length === 0 && pregensNoSetting.length === 0 && (
        <div style={{ fontSize: '14px', color: '#cce0f5', padding: '2rem', textAlign: 'center' }}>
          No pregens match your filters.
        </div>
      )}
    </div>
  )
}

function PregenCard({ name, subtitle, blurb, portraitUrl, setting, isCreating, onUse, editHref }: {
  name: string; subtitle: string; blurb: string; portraitUrl: string | null; setting: string | null
  isCreating: boolean; onUse: () => void; editHref?: string
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
        {setting && (
          <span style={{ position: 'absolute', top: '6px', right: '6px', fontSize: '13px', padding: '2px 7px', borderRadius: '3px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, background: 'rgba(0,0,0,.75)', color: '#cce0f5' }}>
            {setting}
          </span>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '.02em' }}>{name}</div>
        {subtitle && <div style={{ fontSize: '13px', color: '#7ab3d4', marginTop: '2px' }}>{subtitle}</div>}
        {blurb && <div style={{ fontSize: '13px', color: '#6a635c', marginTop: '7px', lineHeight: 1.45, flex: 1 }}>{blurb}</div>}
        <button onClick={onUse} disabled={isCreating} className="pregen-use-btn"
          style={{ marginTop: '10px', padding: '7px', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '4px', color: '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: isCreating ? 'not-allowed' : 'pointer', opacity: isCreating ? 0.6 : 1 }}>
          {isCreating ? 'Creating...' : 'Use this character'}
        </button>
        {editHref && (
          <a href={editHref} style={{ marginTop: '6px', display: 'block', textAlign: 'center', fontSize: '13px', color: '#5a8a9a', textDecoration: 'none', letterSpacing: '.04em', fontFamily: 'Carlito, sans-serif' }}>
            Edit
          </a>
        )}
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
