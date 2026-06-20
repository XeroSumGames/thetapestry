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
  campaignNames: string[]  // from pregen_campaign_map join
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
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [isThriverUser, setIsThriverUser] = useState(false)
  const [storyCampaignName, setStoryCampaignName] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { user } = await getCachedAuth()
      if (user) {
        setUserId(user.id)
        const { data: prof } = await getUserRole(user.id)
        setIsThriverUser(roleIsThriver(prof))
      }
      const [offRes, libRes] = await Promise.all([loadOfficialPregens(), loadApprovedPregens()])
      const rawOff: any[] = offRes?.data ?? []
      setOfficialPregens(rawOff.map((p: any) => ({
        ...p,
        campaignNames: (p.pregen_campaign_map ?? []).map((m: any) => m.campaigns?.name).filter(Boolean),
      })))
      setLibraryPregens((libRes.data ?? []).map((p: any) => ({
        ...p,
        author_username: (p.profiles as any)?.username ?? 'unknown',
        campaignNames: [],
      })))

      if (returnStoryId) {
        const { campaignId } = await getStoryCampaignSetting(returnStoryId)
        if (campaignId) {
          // Find the campaign name from the official pregen data or fallback to setting
          const { setting } = await getStoryCampaignSetting(returnStoryId)
          setStoryCampaignName(setting)
        }
      }

      setLoading(false)
    }
    load()
  }, [returnStoryId])

  const allPregens = useMemo(() => [...officialPregens, ...libraryPregens], [officialPregens, libraryPregens])

  // Distinct campaign names across all official pregens
  const availableCampaigns = useMemo(() => {
    const seen = new Set<string>()
    officialPregens.forEach(p => p.campaignNames.forEach(n => seen.add(n)))
    return [...seen].sort()
  }, [officialPregens])

  const filteredPregens = useMemo(() => {
    const q = search.toLowerCase()
    return allPregens.filter(p => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.data?.profession ?? '').toLowerCase().includes(q)
      const matchesCampaign = !campaignFilter || p.campaignNames.includes(campaignFilter)
      return matchesSearch && matchesCampaign
    })
  }, [allPregens, search, campaignFilter])

  // Group official pregens by campaign name (a pregen can appear in multiple groups)
  const pregensWithCampaign = useMemo(() => {
    return availableCampaigns
      .map(cn => ({
        campaignName: cn,
        pregens: filteredPregens.filter(p => p.campaignNames.includes(cn)),
      }))
      .filter(g => g.pregens.length > 0)
  }, [availableCampaigns, filteredPregens])

  const pregensNoCampaign = useMemo(() =>
    filteredPregens.filter(p => p.campaignNames.length === 0),
    [filteredPregens]
  )

  async function usePregen(pregen: DBPregen) {
    if (creating) return
    setCreating(pregen.id)
    try {
      const { user } = await getCachedAuth()
      if (!user) { router.push('/login'); return }
      const { data: created, error } = await createCharacterForUser(user.id, pregen.name, pregen.data, pregen.portrait_url)
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
        <button onClick={() => setCampaignFilter(null)}
          className={`pregen-chip${campaignFilter === null ? ' active' : ''}`}
          style={filterChip(campaignFilter === null)}>
          All
        </button>
        {availableCampaigns.map(cn => (
          <button key={cn} onClick={() => setCampaignFilter(campaignFilter === cn ? null : cn)}
            className={`pregen-chip${campaignFilter === cn ? ' active' : ''}`}
            style={filterChip(campaignFilter === cn)}>
            {cn}
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

      {/* Campaign-grouped sections */}
      {pregensWithCampaign.map(group => (
        <div key={group.campaignName} style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#7ab3d4', fontWeight: 700 }}>
              {storyCampaignName && group.campaignName.toLowerCase() === storyCampaignName.toLowerCase() ? '★ ' : ''}Authored for &ldquo;{group.campaignName}&rdquo;
            </span>
            <span style={{ fontSize: '13px', color: '#5a5a5a' }}>{group.pregens.length} {group.pregens.length === 1 ? 'character' : 'characters'}</span>
            <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {group.pregens.map(p => (
              <PregenCard
                key={`${group.campaignName}-${p.id}`}
                name={p.name}
                subtitle={p.data?.profession ?? ''}
                blurb={Array.isArray(p.data?.threeWords) ? p.data.threeWords.join(', ') : (p.data?.threeWords ?? '')}
                portraitUrl={p.portrait_url}
                campaignNames={p.campaignNames}
                isCreating={creating === p.id}
                onUse={() => usePregen(p)}
                editHref={(isThriverUser || p.author_id === userId) ? `/pregens/${p.id}/edit` : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      {/* General library - pregens with no campaign associations */}
      {pregensNoCampaign.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#7ab3d4', fontWeight: 700 }}>
              General Library
            </span>
            <span style={{ fontSize: '13px', color: '#5a5a5a' }}>{pregensNoCampaign.length} {pregensNoCampaign.length === 1 ? 'character' : 'characters'}</span>
            <div style={{ flex: 1, height: '1px', background: '#1a1a1a' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {pregensNoCampaign.map(p => (
              <PregenCard
                key={p.id}
                name={p.name}
                subtitle={p.data?.profession ?? ''}
                blurb={Array.isArray(p.data?.threeWords) ? p.data.threeWords.join(', ') : (p.data?.threeWords ?? '')}
                portraitUrl={p.portrait_url}
                campaignNames={[]}
                isCreating={creating === p.id}
                onUse={() => usePregen(p)}
                editHref={(isThriverUser || p.author_id === userId) ? `/pregens/${p.id}/edit` : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && pregensWithCampaign.length === 0 && pregensNoCampaign.length === 0 && (
        <div style={{ fontSize: '14px', color: '#cce0f5', padding: '2rem', textAlign: 'center' }}>
          No pregens match your filters.
        </div>
      )}
    </div>
  )
}

function PregenCard({ name, subtitle, blurb, portraitUrl, campaignNames, isCreating, onUse, editHref }: {
  name: string; subtitle: string; blurb: string; portraitUrl: string | null; campaignNames: string[]
  isCreating: boolean; onUse: () => void; editHref?: string
}) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const badgeColors = [
    { bg: 'rgba(20,55,90,0.92)', color: '#9dd0ef' },
    { bg: 'rgba(18,50,18,0.92)', color: '#7fc458' },
    { bg: 'rgba(80,42,20,0.92)', color: '#e8b08a' },
  ]
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
        {campaignNames.length > 0 && (
          <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
            {campaignNames.slice(0, 3).map((cn, i) => (
              <span key={cn} style={{ fontSize: '13px', padding: '2px 7px', borderRadius: '3px', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, background: badgeColors[i].bg, color: badgeColors[i].color, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cn}
              </span>
            ))}
          </div>
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
