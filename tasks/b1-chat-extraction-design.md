# B1 — Chat panel extraction design

Plan for extracting the chat-related code out of `app/stories/[id]/table/page.tsx`. Before any code changes.

## What's currently in the table page

### State (4 things)
- `chatMessages` (line 737) — array of message rows
- `chatInput` (line 738) — composer textarea content
- `chatChannelRef` (line 739) — the realtime channel handle
- `whisperTarget` (line 740) — currently selected whisper recipient. **Shared with the rolls tab UI** (clicking "whisper this player" on a roll sets it).

### Functions (2)
- `loadChat(campaignId)` (lines 867-894) — fetches last 100, filters whispers client-side, auto-switches to chat tab on incoming whisper
- `sendChat()` (lines 896-1000) — handles `/d` dice rolls, `/w` whisper command parsing, then inserts into `chat_messages`

### Effects / channels
- Line 1157: `loadChat(id)` fired in initial Promise.all
- Lines 1236-1237: subscribes to `postgres_changes` on `chat_messages` filtered by campaign_id, calls `loadChat(id)` on event
- Lines 1261-1266: `logs_cleared` broadcast handler — `setChatMessages([])` + `loadChat(id)`. **This handler is on the INITIATIVE channel, not the chat channel.**
- Line 1392: cleanup `removeChannel(chatChannelRef.current)`

### Render (3 places)
- **Lines 5856-5859**: Tab switcher buttons (`'rolls' | 'chat' | 'both'`) — drives both rolls and chat. NOT chat-only.
- **Lines 6195-6215**: Chat-tab render block (chat-only message list)
- **Lines 6217-6244**: Both-tab merged render — interleaves rolls + chat sorted by created_at. Re-renders the chat message visual using duplicated JSX.
- **Lines 6422-6443**: Bottom input composer (textarea + Send button + whisper indicator). Visible when `feedTab === 'chat' || 'both'`.

### Cross-cutting touch points
- `setChatMessages([])` is called from `startSession` (line 2588) and `endSession` (line 2635) — these clear local state synchronously before the broadcast goes out.
- `chat_messages` table is also DELETEd from supabase in `startSession` (line 2609) and `endSession` (line 2661). That DELETE belongs with session lifecycle, not chat.
- Whisper flow at line 7417: clicking "whisper this player" sets `whisperTarget` and switches `feedTab` to `'chat'`. Lives in the rolls render.

## What complicates a clean extraction

1. **`feedTab` is shared between rolls and chat.** Tab state can't move into a chat component without breaking the rolls/both views.
2. **The Both tab merges chat + rolls.** A pure `<TableChat>` component can't render that view alone. Either:
   - Parent keeps the merged render (chat exposes its messages via prop or hook)
   - Chat component takes `interleavedRolls` as a prop and handles all 3 modes itself
3. **`whisperTarget` is also shared** — the rolls tab UI sets it (line 7417). Either move it into a context, or keep it in the parent and pass down.
4. **Code duplication** between Chat-tab render (6199-6213) and Both-tab chat render (6230-6240). Extraction is a good time to dedupe.

## Proposed component shape

```ts
// components/TableChat.tsx
interface TableChatProps {
  campaignId: string
  userId: string
  isGM: boolean
  campaign: Campaign | null  // for gm_user_id (whisper to GM via /w gm)
  entries: TableEntry[]      // for character lookup in /w name parsing + render
  whisperTarget: { userId: string; characterName: string } | null
  setWhisperTarget: (t: WhisperTarget | null) => void
  feedTab: 'rolls' | 'chat' | 'both'
  setFeedTab: (t: 'rolls' | 'chat' | 'both') => void
  // Both-tab needs rolls to interleave. Parent passes them in.
  rollsForBothTab?: RollEntry[]
  // External state-clearing hooks for session start/end
  // (parent calls chatRef.current?.clear() when session lifecycle fires).
}

// Owns: chatMessages, chatInput, chatChannelRef, loadChat, sendChat
// Renders: Chat-tab list | Both-tab merged | Composer at bottom
// Parent renders: tab switcher buttons (still parent-owned because feedTab is parent state)
```

`whisperTarget` and `feedTab` stay in the parent because the rolls render uses them too. Chat receives them as props.

## Staged extraction plan

Each stage is a separate commit + safepoint tag. Tested locally before moving to next stage.

### Stage 1 — Custom hook (no render change)
Create `hooks/useChatPanel.ts`:
- Owns `chatMessages`, `chatInput`, `chatChannelRef`
- Exports `{ messages, input, setInput, send, clear, refetch }` plus internal channel subscription via useEffect
- Replaces inline state/functions in the table page with `const chat = useChatPanel({...})`
- All render code still inline in the parent, just reads from `chat.messages` instead of `chatMessages`.

**Risk:** low. Pure refactor. The cleanup-from-startSession/endSession case becomes `chat.clear()` instead of `setChatMessages([])`.

**Tag:** `safepoint/b1-stage1-hook`

### Stage 2 — Extract chat-only render
Create `components/TableChat.tsx`. Initial responsibility: chat-only tab + composer. Both-tab merged render STAYS in parent (reads `chat.messages` via the hook's exposed array).

Parent renders `{feedTab === 'chat' && <TableChat ... />}` and the composer block conditionally.

**Risk:** low-medium. Pure render move. Need to make sure the composer's Enter-key handler, whisper indicator, and dice-command logic still work.

**Tag:** `safepoint/b1-stage2-render`

### Stage 3 — Pull Both-tab render into the component
TableChat now takes `rollsForBothTab?: RollEntry[]` and handles all 3 tab modes internally. Composer moves inside the component too.

Parent renders `<TableChat feedTab={feedTab} rollsForBothTab={feedTab === 'both' ? rolls : undefined} />`.

**Risk:** medium. The Both-tab merged sort logic moves with the chat side. The roll-render JSX inside Both stays referenced from the parent (passed in as a `renderRoll: (r: RollEntry) => ReactNode` callback), OR we move the whole feed in one shot (defer to B1 stage 4 / B2).

**Tag:** `safepoint/b1-stage3-bothtab`

### Stage 4 — Lazy-load
`const TableChat = dynamic(() => import('../components/TableChat'), { ssr: false, loading: () => null })`.

**Risk:** very low. Mechanical dynamic() wrap.

**Tag:** `safepoint/b1-stage4-lazy`

## Things I'm explicitly NOT doing

- Not extracting the `feedTab` tab switcher (it's shared with rolls — that goes with B2).
- Not extracting `whisperTarget` state (shared with rolls render).
- Not changing the realtime subscription behavior or RLS filtering.
- Not changing the slash-command parsing or dice-roll output.
- Not touching the session-start/end lifecycle (just adapting the cleanup call to use `chat.clear()`).

## Test plan per stage

Each stage gets a tasks/ test plan. Generic checks:
1. Send a normal chat message — appears for self and other clients in real time.
2. Send `/d 3d6+2` — formatted dice result appears as a chat message.
3. Send `/w gm hi` — whisper to GM, only visible to sender + GM.
4. Send `/w PercyBent hello` — whisper to a specific PC by name.
5. Click "whisper this player" on a roll → `whisperTarget` set, `feedTab` switches to chat. Type a message → goes to that player.
6. Open chat tab vs both tab — both render correctly.
7. Start a new session as GM — chat clears (local + DB).
8. End a session — chat clears.

If any stage breaks any of these, roll back the safepoint tag for that stage and we figure out why.

## How it gets to live

Once stages 1-4 are all green and you've used it through a real session locally, fast-forward main:

```
git -C C:/TheTapestry checkout main
git -C C:/TheTapestry merge --ff-only perf/local-test
git -C C:/TheTapestry push origin main
```

That triggers Vercel deploy and the lazy-loaded chat is live.

---

**Confirm before I start coding:**
- Does the staged plan make sense to you, or do you want me to bundle stages?
- Any concerns about the prop shape?
- The hook approach (Stage 1) is gentler than going straight to a component — sound right?
