'use client'
// FeedColumn - the left game-feed column (Logs / Chat / Both tabs + the chat
// composer). Extracted from page.tsx verbatim (table re-arch Step 2 leaf).
// Pure presentational composition over already-extracted children
// (MessagesBell / NotificationBell / BugReportButton / RollEntryCard /
// ChatMessageList / ChatMessageRow / ChatComposer); no trunk-system calls. The
// GM-only "⭐ Award" overlay just pre-fills the Grant Advantage modal state via
// the threaded setters. rollsFeed + chat are passed as whole hook objects;
// useChatPanel/useRollsFeed stay at page level. formatTime is a pure lib import.

import NotificationBell from '../../../../../components/NotificationBell'
import MessagesBell from '../../../../../components/MessagesBell'
import BugReportButton from '../../../../../components/BugReportButton'
import { ChatMessageRow, ChatMessageList, ChatComposer } from '../../../../../components/TableChat'
import { RollEntry as RollEntryCard } from '../../../../../components/RollsFeed'
import { formatTime } from '../../../../../lib/roll-helpers'

interface FeedColumnProps {
  campaignId: string
  myUsername: string
  isGM: boolean
  gmLike: boolean
  feedTab: 'rolls' | 'chat' | 'both' | 'map'
  setFeedTab: any
  sessionStatus: string
  sessionActing: boolean
  startSession: () => void
  rollsFeed: any
  chat: any
  entries: any[]
  userId: string | null
  campaign: any
  setFeedScrollContainer: (el: HTMLDivElement | null) => void
  feedScrollEl: HTMLDivElement | null
  whisperTarget: any
  setWhisperTarget: any
  setGrantPcId: any
  setGrantSkill: any
  setGrantCmod: any
  setGrantDescription: any
  setGrantSourceRollLogId: any
  setGrantError: any
  setShowGrantAdvantage: any
}

export function FeedColumn({
  campaignId, myUsername, isGM, gmLike, feedTab, setFeedTab, sessionStatus, sessionActing, startSession,
  rollsFeed, chat, entries, userId, campaign, setFeedScrollContainer, feedScrollEl,
  whisperTarget, setWhisperTarget,
  setGrantPcId, setGrantSkill, setGrantCmod, setGrantDescription, setGrantSourceRollLogId, setGrantError, setShowGrantAdvantage,
}: FeedColumnProps) {
  return (
    <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid #2e2e2e', display: 'flex', flexDirection: 'column', background: '#111', overflow: 'hidden' }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
        <div style={{ fontSize: '15px', color: '#7fc458', fontFamily: 'Carlito, sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#c0392b' }}>{myUsername}{isGM ? ' (GM)' : ''}</span>
          {/* Fixed-width cells so the three icons sit at evenly
              spaced visual centers regardless of each component's
              internal button padding. Same approach as the
              Sidebar's bottom-icon row (see Sidebar.tsx comment). */}
          <div style={{ width: '32px', display: 'flex', justifyContent: 'center' }}><MessagesBell /></div>
          <div style={{ width: '32px', display: 'flex', justifyContent: 'center' }}><NotificationBell /></div>
          <div style={{ width: '32px', display: 'flex', justifyContent: 'center' }}><BugReportButton /></div>
        </div>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid #2e2e2e', flexShrink: 0 }}>
        {(['rolls', 'chat', 'both'] as const).map(tab => (
          <button key={tab} onClick={() => setFeedTab(tab)}
            style={{ flex: 1, padding: '8px 0', background: feedTab === tab ? '#1a1a1a' : 'transparent', border: 'none', borderBottom: feedTab === tab ? '2px solid #c0392b' : '2px solid transparent', color: feedTab === tab ? '#f5f2ee' : '#cce0f5', fontSize: '13px', fontWeight: 600, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {tab === 'rolls' ? 'Logs' : tab === 'chat' ? 'Chat' : 'Both'}
          </button>
        ))}
        {gmLike && (
          <button onClick={() => setFeedTab('map')}
            style={{ flex: 1, padding: '8px 0', background: feedTab === 'map' ? '#1a1a1a' : 'transparent', border: 'none', borderBottom: feedTab === 'map' ? '2px solid #c0392b' : '2px solid transparent', color: feedTab === 'map' ? '#f5f2ee' : '#cce0f5', fontSize: '13px', fontWeight: 600, fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
            Map
          </button>
        )}
      </div>
      {feedTab === 'map' ? (
        <iframe src={`/scene-controls-popout?c=${campaignId}`} title="Map Setup"
          style={{ flex: 1, height: 0, border: 'none', display: 'block', minHeight: 0 }} />
      ) : (
      <div ref={setFeedScrollContainer} style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {sessionStatus === 'idle' && (
          gmLike ? (
            <button onClick={startSession} disabled={sessionActing}
              style={{ width: '100%', textAlign: 'center', padding: '8px', marginBottom: '8px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px', cursor: sessionActing ? 'not-allowed' : 'pointer', opacity: sessionActing ? 0.6 : 1 }}>
              {sessionActing ? 'Starting...' : 'Start Session'}
            </button>
          ) : (
            <div style={{ textAlign: 'center', padding: '8px', marginBottom: '8px', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#7fc458', background: '#1a2e10', border: '1px solid #2d5a1b', borderRadius: '3px' }}>
              Waiting for GM to open the session
            </div>
          )
        )}
        {/* Roll entries (Logs tab only) */}
        {feedTab === 'rolls' && (
          rollsFeed.rolls.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{sessionStatus === 'idle' ? '⏸' : '🎲'}</div>
              <div style={{ fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {sessionStatus === 'idle' ? 'Session not active' : 'Click a skill or attribute on your sheet to roll'}
              </div>
            </div>
          ) : (
            rollsFeed.rolls.map((r: any) => {
              // Phase 4: GM-only "⭐ Award" button overlay on dice-
              // result rows. Pre-fills the Grant Advantage modal
              // with the roller as PC + this row's id as the source.
              // Skipped for system / banner rows (combat_start,
              // drop, action, etc) - only meaningful on rolls a PC
              // actually made.
              const isDiceRow = (r.die1 ?? 0) > 0 || (r.die2 ?? 0) > 0
              const rollerPc = isDiceRow ? entries.find(e => e.character.name === r.character_name) : null
              return (
                <div key={r.id} style={{ position: 'relative' }}>
                  <RollEntryCard
                    r={r as any}
                    expandedRollIds={rollsFeed.expandedRollIds}
                    toggleExpanded={rollsFeed.toggleExpanded}
                  />
                  {gmLike && isDiceRow && rollerPc && (
                    <button type="button"
                      title={`Grant an advantage to ${rollerPc.character.name} based on this roll`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setGrantPcId(rollerPc.character.id)
                        setGrantSkill('')
                        setGrantCmod(1)
                        setGrantDescription('')
                        setGrantSourceRollLogId(r.id)
                        setGrantError(null)
                        setShowGrantAdvantage(true)
                      }}
                      style={{ position: 'absolute', bottom: '4px', right: '4px', padding: '2px 8px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', opacity: 0.8 }}>
                      ⭐
                    </button>
                  )}
                </div>
              )
            })
          )
        )}
        {/* Chat messages (Chat tab only) - render delegated. */}
        {feedTab === 'chat' && (
          <ChatMessageList messages={chat.messages} viewerUserId={userId} entries={entries} formatTime={formatTime} scrollParent={feedScrollEl} />
        )}
        {/* Both tab - merged chronological feed. Roll branches stay
            inline (huge JSX with lots of parent-scope helpers); chat
            branch delegates to <ChatMessageRow> for dedup with the
            Chat-tab path above. */}
        {feedTab === 'both' && (() => {
          const merged: { type: 'roll' | 'chat'; created_at: string; data: any }[] = [
            ...rollsFeed.rolls.map((r: any) => ({ type: 'roll' as const, created_at: r.created_at, data: r })),
            ...chat.messages.map((m: any) => ({ type: 'chat' as const, created_at: m.created_at, data: m })),
          ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          if (merged.length === 0) return (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#3a3a3a' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{sessionStatus === 'idle' ? '⏸' : '💬'}</div>
              <div style={{ fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {sessionStatus === 'idle' ? 'Session not active' : 'No activity yet'}
              </div>
            </div>
          )
          return merged.map(item => item.type === 'chat' ? (
            <ChatMessageRow key={`chat-${item.data.id}`} message={item.data} viewerUserId={userId} entries={entries} formatTime={formatTime} />
          ) : (() => {
            const r = item.data
            const isDiceRow = (r.die1 ?? 0) > 0 || (r.die2 ?? 0) > 0
            const rollerPc = isDiceRow ? entries.find(e => e.character.name === r.character_name) : null
            return (
              <div key={`roll-${r.id}`} style={{ position: 'relative' }}>
                <RollEntryCard
                  r={r as any}
                  expandedRollIds={rollsFeed.expandedRollIds}
                  toggleExpanded={rollsFeed.toggleExpanded}
                  simple
                />
                {gmLike && isDiceRow && rollerPc && (
                  <button type="button"
                    title={`Grant an advantage to ${rollerPc.character.name} based on this roll`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setGrantPcId(rollerPc.character.id)
                      setGrantSkill('')
                      setGrantCmod(1)
                      setGrantDescription('')
                      setGrantSourceRollLogId(r.id)
                      setGrantError(null)
                      setShowGrantAdvantage(true)
                    }}
                    style={{ position: 'absolute', bottom: '4px', right: '4px', padding: '2px 8px', background: '#2a2010', border: '1px solid #5a4a1b', borderRadius: '3px', color: '#EF9F27', fontSize: '13px', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', cursor: 'pointer', opacity: 0.8 }}>
                    ⭐
                  </button>
                )}
              </div>
            )
          })()
          )
        })()}
      </div>
      )}
      {/* Bottom: chat composer (textarea + Send + whisper indicator).
          Owns its own input state and the slash-command parsing
          inside <ChatComposer> - see components/TableChat.tsx. */}
      <div style={{ borderTop: '1px solid #2e2e2e', flexShrink: 0 }}>
        {(feedTab === 'chat' || feedTab === 'both') && (
          <ChatComposer
            campaignId={campaignId}
            userId={userId}
            isGM={gmLike}
            campaign={campaign}
            entries={entries}
            whisperTarget={whisperTarget}
            setWhisperTarget={setWhisperTarget}
          />
        )}
      </div>
    </div>
  )
}
