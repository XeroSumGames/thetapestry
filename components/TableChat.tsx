'use client'
// Chat panel pieces for the GM-table feed area.
//
// What lives where:
//   - useChatPanel (hook)        — owns chat state + realtime channel.
//                                  Parent calls this so it can read
//                                  `messages` for the Both-tab merged
//                                  render that interleaves chat+rolls.
//   - <ChatMessageRow>           — single-message bubble. Used both
//                                  by <ChatMessageList> (Chat tab) and
//                                  by the parent's Both-tab merged feed.
//   - <ChatMessageList>          — Chat-tab full list (empty state
//                                  + map). Renders only when feedTab
//                                  === 'chat'.
//   - <ChatComposer>             — textarea + Send button + whisper
//                                  indicator. Owns input state and the
//                                  send/slash-command logic. Renders
//                                  whenever feedTab is 'chat' or 'both'.
//
// Parent keeps ownership of:
//   - feedTab and the tab switcher (shared with the rolls feed).
//   - whisperTarget state (also set from the rolls/portrait UI).
//   - The Both-tab merged render (uses both rolls + chat data).
//   - Session-lifecycle clears (calls `chat.clear()` on start/end).
//
// The list and the composer live in different layout containers in
// the parent (scroll area vs fixed bottom strip), so they're separate
// exports rather than a single wrapper component.

import { memo, useEffect, useRef, useState, useCallback } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { createClient } from '../lib/supabase-browser'
import { renderRichText } from '../lib/rich-text'

// ── Types ────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  user_id: string
  character_name: string
  message: string
  created_at: string
  is_whisper?: boolean
  recipient_user_id?: string | null
}

export interface WhisperTarget {
  userId: string
  characterName: string
}

// Minimal subset of TableEntry the chat actually reads — keeps the
// component decoupled from the parent's full TableEntry shape.
export interface ChatTableEntry {
  userId: string
  username: string
  character: { name: string }
}

// Minimal subset of Campaign — only gm_user_id is read (for /w gm).
export interface ChatCampaign {
  gm_user_id: string
}

// ── Hook ─────────────────────────────────────────────────────────

export interface UseChatPanelArgs {
  campaignId: string
  // userIdRef so refetch always reads the freshest value — parent's
  // userId state can be stale inside long-lived closures.
  userIdRef: React.MutableRefObject<string | null>
  // Auto-switch the parent's feed tab when an inbound whisper lands.
  setFeedTab: (t: 'rolls' | 'chat' | 'both') => void
  // Called after a refetch so the parent can scroll its feed
  // container to the bottom (the feed scrollbox lives in the parent).
  scrollFeedToBottom: () => void
}

export function useChatPanel({ campaignId, userIdRef, setFeedTab, scrollFeedToBottom }: UseChatPanelArgs) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const channelRef = useRef<any>(null)

  // Stash the parent-provided callbacks in refs so refetch can stay
  // referentially stable across renders. Without this — if the parent
  // passes inline arrow functions (which they will, by default) — every
  // render recreates the callbacks, refetch's deps change, the
  // useEffects below fire on every render, the realtime channel
  // re-subscribes, and the postgres_changes events compound into a
  // tight refetch loop. Caused a hung "Loading The Table..." mount in
  // playtest 2026-04-29 because the loop was eating every cycle.
  const setFeedTabRef = useRef(setFeedTab)
  const scrollFeedToBottomRef = useRef(scrollFeedToBottom)
  setFeedTabRef.current = setFeedTab
  scrollFeedToBottomRef.current = scrollFeedToBottom

  const refetch = useCallback(async () => {
    const uid = userIdRef.current
    // Simple query; whisper privacy is RLS-enforced server-side.
    // Defense-in-depth: also filter client-side so a slow-propagating
    // RLS change can't briefly leak whispers into someone else's UI.
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) { console.warn('[useChatPanel] fetch error:', error.message); return }
    const visible = (data ?? []).filter((m: any) => {
      if (!m.is_whisper) return true
      if (!uid) return false
      return m.user_id === uid || m.recipient_user_id === uid
    })
    const next = visible.reverse() as ChatMessage[]
    setMessages(prev => {
      // Auto-flip to Chat tab on a freshly-arrived inbound whisper.
      // Skip on the initial load (`prev.length === 0`) so navigating
      // into the page with old whispers in the buffer doesn't yank
      // the GM out of whatever tab they were on.
      const prevIds = new Set(prev.map(m => m.id))
      const incoming = next.find((m) => !prevIds.has(m.id) && m.is_whisper && m.recipient_user_id === uid && m.user_id !== uid)
      if (incoming && prev.length > 0) setFeedTabRef.current('chat')
      return next
    })
    setTimeout(() => { scrollFeedToBottomRef.current() }, 50)
  }, [campaignId, supabase, userIdRef])

  const clear = useCallback(() => setMessages([]), [])

  useEffect(() => {
    if (!campaignId) return
    refetch()
    channelRef.current = supabase.channel(`chat_${campaignId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'chat_messages',
        filter: `campaign_id=eq.${campaignId}`,
      }, () => { refetch() })
      .subscribe()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }, [campaignId, refetch, supabase])

  // Re-pull chat history on hidden→visible. Chrome can pause the tab's
  // websocket while backgrounded, so any chat_messages INSERT during
  // that window is missed by the realtime sub. The realtime channel
  // itself reconnects internally; this effect just patches the gap in
  // history. Mirrors the same handler on the parent table page.
  useEffect(() => {
    if (!campaignId) return
    function handleVisibility() {
      if (!document.hidden) refetch()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [campaignId, refetch])

  return { messages, clear, refetch }
}

// ── Single-message render ────────────────────────────────────────

interface ChatMessageRowProps {
  message: ChatMessage
  viewerUserId: string | null
  entries: ChatTableEntry[]
  formatTime: (iso: string) => string
}

// React.memo so a parent re-render doesn't re-execute the entries.find
// + renderRichText for every visible chat row when nothing about that
// row changed. Pairs with virtualization in <ChatMessageList> below —
// virtualization keeps off-screen rows out of the DOM, memo keeps
// on-screen rows from re-parsing on unrelated parent ticks.
export const ChatMessageRow = memo(function ChatMessageRow({
  message, viewerUserId, entries, formatTime,
}: ChatMessageRowProps) {
  const isW = !!message.is_whisper
  const whisperLabel = isW
    ? message.user_id === viewerUserId
      ? `Whisper to ${entries.find(e => e.userId === message.recipient_user_id)?.character.name ?? 'someone'}`
      : `Whisper from ${message.character_name}`
    : null
  return (
    <div style={{
      marginBottom: '6px',
      padding: '6px 8px',
      background: isW ? '#1a1a2a' : '#1a1a1a',
      border: `1px solid ${isW ? '#4a2a6a' : '#2e2e2e'}`,
      borderRadius: '3px',
      borderLeft: `3px solid ${isW ? '#8b2e8b' : '#7ab3d4'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: isW ? '#d48bd4' : '#7ab3d4', fontFamily: 'Carlito, sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {isW ? whisperLabel : message.character_name}
        </span>
        <span style={{ fontSize: '13px', color: '#cce0f5' }}>{formatTime(message.created_at)}</span>
      </div>
      <div style={{ fontSize: '14px', color: '#f5f2ee', lineHeight: 1.4 }}>{renderRichText(message.message)}</div>
    </div>
  )
})

// ── Chat-tab list ────────────────────────────────────────────────

interface ChatMessageListProps {
  messages: ChatMessage[]
  viewerUserId: string | null
  entries: ChatTableEntry[]
  formatTime: (iso: string) => string
  // The parent's existing scroll container. When supplied, the list
  // virtualizes via react-virtuoso's `customScrollParent` mode — only
  // visible rows get rendered, even though the parent owns the scrollbar
  // (shared with the Logs / Both tabs). Until the ref resolves on first
  // mount we fall back to a plain map render so nothing flickers.
  scrollParent?: HTMLElement | null
}

export function ChatMessageList({
  messages, viewerUserId, entries, formatTime, scrollParent,
}: ChatMessageListProps) {
  if (messages.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#cce0f5', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase' }}>
        No messages yet
      </div>
    )
  }
  // First render: scrollParent state hasn't resolved yet (parent's
  // useEffect populates it post-mount). Render the rows plainly so
  // there's no flash of empty list. Once the parent re-renders with
  // the resolved scrollParent, we swap to the virtualized path.
  if (!scrollParent) {
    return (
      <>
        {messages.map(m => (
          <ChatMessageRow key={m.id} message={m} viewerUserId={viewerUserId} entries={entries} formatTime={formatTime} />
        ))}
      </>
    )
  }
  return (
    <Virtuoso
      data={messages}
      customScrollParent={scrollParent}
      // followOutput="smooth" keeps the list anchored to the bottom on
      // new messages — same behavior the parent's scroll-to-bottom
      // helper provides for the rolls feed. Returning 'smooth' from
      // the function (rather than the boolean true) lets Virtuoso
      // skip the auto-scroll if the user has scrolled up to read
      // older messages, so receiving a new line doesn't yank them
      // back to the bottom.
      followOutput={(atBottom) => atBottom ? 'smooth' : false}
      itemContent={(_, m) => (
        <ChatMessageRow
          message={m}
          viewerUserId={viewerUserId}
          entries={entries}
          formatTime={formatTime}
        />
      )}
      computeItemKey={(_, m) => m.id}
    />
  )
}

// ── Composer (textarea + Send) ───────────────────────────────────

interface ChatComposerProps {
  campaignId: string
  userId: string | null
  isGM: boolean
  campaign: ChatCampaign | null
  entries: ChatTableEntry[]
  whisperTarget: WhisperTarget | null
  setWhisperTarget: (t: WhisperTarget | null) => void
}

export function ChatComposer({ campaignId, userId, isGM, campaign, entries, whisperTarget, setWhisperTarget }: ChatComposerProps) {
  const supabase = createClient()
  const [input, setInput] = useState('')

  async function send() {
    if (!input.trim() || !userId) return
    const myEntry = entries.find(e => e.userId === userId)
    const characterName = myEntry?.character.name ?? (isGM ? 'Game Master' : 'Unknown')
    const trimmed = input.trim()
    let recipientUserId: string | null = whisperTarget?.userId ?? null
    let isWhisper = !!whisperTarget
    let messageBody = trimmed

    // Dice roller — `/r <expr>` or `/roll <expr>`. Expression is
    // NdM with optional +/- modifiers (e.g. `/r 1d6`, `/r 3d20+3-1`).
    // Output replaces the chat body with a formatted result line and
    // rides through the normal send path (so it respects whisper
    // target — set whisper to GM first if you want a secret roll).
    // Capped at 100 dice / 1000 sides as a safety guard. Trigger was
    // `/d` originally; flipped to `/r` per Xero on 2026-05-04 since
    // `/d` collided with muscle memory from other tools that use it
    // as a delete shortcut.
    const diceCmd = trimmed.match(/^\/r(?:oll)?\s+(.+)$/i)
    if (diceCmd) {
      const expr = diceCmd[1].replace(/\s+/g, '')
      const m = expr.match(/^(\d+)d(\d+)((?:[+\-]\d+)*)$/i)
      if (!m) {
        alert(`Bad dice expression: "${diceCmd[1]}"\n\nFormat: /r NdM[+/-K] — e.g. /r 1d6, /r 3d20+3+2-1, /r 1d100-2`)
        return
      }
      const count = Math.min(100, Math.max(1, parseInt(m[1], 10)))
      const sides = Math.min(1000, Math.max(2, parseInt(m[2], 10)))
      let modifier = 0
      const modPart = m[3] ?? ''
      const modMatches = modPart.matchAll(/([+\-])(\d+)/g)
      for (const mm of modMatches) {
        modifier += (mm[1] === '+' ? 1 : -1) * parseInt(mm[2], 10)
      }
      const rolls: number[] = []
      for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1)
      const sum = rolls.reduce((a, b) => a + b, 0)
      const total = sum + modifier
      const exprPretty = modifier === 0
        ? `${count}d${sides}`
        : `${count}d${sides}${modifier > 0 ? '+' : ''}${modifier}`
      const modStr = modifier === 0 ? '' : modifier > 0 ? ` +${modifier}` : ` ${modifier}`
      messageBody = `🎲 ${exprPretty} → [${rolls.join('+')}]${modStr} = ${total}`
    }

    // Whisper command — `/whisper <target> <body>` or `/w <target> <body>`.
    // Walks the tail of the command from longest-prefix to shortest,
    // trying each candidate as exact / prefix / substring against
    // character_name OR username (case-insensitive). So all of these
    // route correctly to the same player:
    //   /w Percy hi          (first name of "Percy Bent")
    //   /w Percy Bent hi     (full character name)
    //   /w marv hey          (prefix of "Marvin")
    //   /w tony hey          (username, even if char name differs)
    // Special target `gm` routes to the campaign's GM.
    const slashHead = trimmed.match(/^\/(?:w|whisper)\s+([\s\S]+)$/i)
    if (slashHead) {
      const rest = slashHead[1].trim()
      const words = rest.split(/\s+/)
      let matched = false
      for (let take = Math.min(words.length - 1, 5); take >= 1 && !matched; take--) {
        const target = words.slice(0, take).join(' ')
        const body = words.slice(take).join(' ')
        if (!body) continue
        if (/^gm$/i.test(target) && campaign?.gm_user_id) {
          recipientUserId = campaign.gm_user_id
          isWhisper = true
          messageBody = body
          matched = true
          break
        }
        const t = target.toLowerCase()
        const candidates = entries.filter(e => {
          const name = (e.character.name ?? '').toLowerCase()
          const user = (e.username ?? '').toLowerCase()
          return name === t || user === t
            || name.startsWith(t) || user.startsWith(t)
            || name.includes(t) || user.includes(t)
        })
        // Prefer exact > prefix > substring when multiple candidates match.
        const rank = (e: ChatTableEntry) => {
          const name = (e.character.name ?? '').toLowerCase()
          const user = (e.username ?? '').toLowerCase()
          if (name === t || user === t) return 0
          if (name.startsWith(t) || user.startsWith(t)) return 1
          return 2
        }
        candidates.sort((a, b) => rank(a) - rank(b))
        const hit = candidates[0]
        if (hit?.userId) {
          recipientUserId = hit.userId
          isWhisper = true
          messageBody = body
          matched = true
        }
      }
    }

    if (!messageBody.trim()) return
    await supabase.from('chat_messages').insert({
      campaign_id: campaignId,
      user_id: userId,
      character_name: characterName,
      message: messageBody,
      is_whisper: isWhisper,
      recipient_user_id: recipientUserId,
    })
    setInput('')
  }

  return (
    <div>
      {whisperTarget && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#2a102a', borderBottom: '1px solid #8b2e8b' }}>
          <span style={{ fontSize: '13px', color: '#d48bd4', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Whispering to {whisperTarget.characterName}
          </span>
          <button onClick={() => setWhisperTarget(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#d48bd4', cursor: 'pointer', fontSize: '13px', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0', padding: '6px 8px', alignItems: 'stretch' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={whisperTarget ? `Whisper to ${whisperTarget.characterName}...` : 'Type a message...'}
          rows={2}
          style={{ flex: 1, padding: '6px 8px', background: whisperTarget ? '#1a1a2a' : '#242424', border: `1px solid ${whisperTarget ? '#8b2e8b' : '#3a3a3a'}`, borderRight: 'none', borderRadius: '3px 0 0 3px', color: '#f5f2ee', fontSize: '13px', fontFamily: 'Carlito, sans-serif', outline: 'none', resize: 'none', lineHeight: '1.4' }} />
        <button onClick={send}
          style={{ width: '24px', flexShrink: 0, background: whisperTarget ? '#2a102a' : '#1a2e10', border: `1px solid ${whisperTarget ? '#8b2e8b' : '#2d5a1b'}`, borderRadius: '0 3px 3px 0', color: whisperTarget ? '#d48bd4' : '#7fc458', fontSize: '13px', fontFamily: 'Carlito, sans-serif', textTransform: 'uppercase', cursor: 'pointer', writingMode: 'vertical-rl', letterSpacing: '.08em', padding: 0, transform: 'rotate(180deg)' }}>Send</button>
      </div>
    </div>
  )
}
