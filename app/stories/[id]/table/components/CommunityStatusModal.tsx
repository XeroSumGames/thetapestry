'use client'
// CommunityStatusModal - overlay-docked wrapper around <CampaignCommunity> so
// players can check pending requests / Apprentice links / role coverage without
// leaving the table page. Extracted from page.tsx verbatim (table re-arch
// Step 2 leaf). Thin presentational shell; CampaignCommunity owns all the
// management logic. Loaded via the same dynamic({ ssr: false }) import as the
// page used, so behavior (no SSR, no loading flash) is unchanged. State +
// setTradeTarget threaded as props.

import dynamic from 'next/dynamic'

const CampaignCommunity = dynamic(() => import('../../../../../components/CampaignCommunity'), { ssr: false, loading: () => null })

interface CommunityStatusModalProps {
  open: boolean
  onClose: () => void
  campaignId: string
  isGM: boolean
  communityModalMode: 'status' | 'create'
  communityModalToken: number
  myEntry: any
  setTradeTarget: any
}

export function CommunityStatusModal({
  open, onClose, campaignId, isGM, communityModalMode, communityModalToken, myEntry, setTradeTarget,
}: CommunityStatusModalProps) {
  if (!open) return null
  return (
    <div onClick={() => onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: '4px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #2e2e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14px', color: '#7fc458', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', fontFamily: 'Carlito, sans-serif' }}>Community</div>
          <button onClick={() => onClose()}
            style={{ background: 'none', border: 'none', color: '#d4cfc9', fontSize: '20px', cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}
            title="Close">✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <CampaignCommunity
            campaignId={campaignId}
            isGM={isGM}
            initialMode={communityModalMode}
            initialModeToken={communityModalToken}
            onOpenTradeWithCommunity={myEntry ? (communityId: string) => setTradeTarget({ kind: 'community', id: communityId }) : undefined}
          />
        </div>
      </div>
    </div>
  )
}
