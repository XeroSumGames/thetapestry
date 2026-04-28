# Testplan — Visibility refetch on tab backgrounding

## What changed

GrumpyBattersby's playtest bug: after backgrounding the Tapestry table tab for a few minutes, the player came back to a stale view — chat, rolls, initiative all out of sync with the live game. Chrome throttles inactive tabs and can pause the websocket without a clean close, so any `postgres_changes` events that fire during the dead window are silently dropped. The tab "looks" connected (the channel state is `joined`) but no events arrive until a full F5.

Fix shape (intentionally minimal): on `document.visibilitychange` → visible, re-pull the same state the mount effect originally hydrated. Two surfaces:

- **`app/stories/[id]/table/page.tsx`** — new effect that calls `loadEntries`, `loadRolls`, `loadInitiative`, `loadPlayerNpcCommunityMap`, refreshes `campaign_npcs`, and re-runs `loadRevealedNpcs` (GM gets all, player gets per-character). Mirrors the mount effect's load sequence.
- **`components/TableChat.tsx`** — `useChatPanel` hook gets a sibling effect that calls `refetch()` on visible.

**Channel rebuild is intentionally NOT done in this PR.** `supabase-js` runs its own heartbeat and reconnects the socket internally on health-check failure — re-subscribing channels would mostly duplicate that, at the cost of a churny reconnect every time you tab away for 10 seconds. If users still report staleness *after* state refetches, expand to a teardown + resubscribe.

No SQL, no schema, no behavior change for users who keep the tab in the foreground.

## Test cases

### Setup
- Two browsers / profiles. **GM tab**: `/stories/<id>/table` for an active campaign with at least one NPC and one PC. **Player tab**: same campaign, joined as a player.

### 1. Stale chat
1. **Player tab** — focus, see latest chat history.
2. Switch to a different application (or different tab) for 2+ minutes.
3. **GM tab** — send 2-3 chat messages while the player is backgrounded.
4. **Player tab** — return focus.

**Expected:** Within ~1s of the tab becoming visible, the new GM messages appear in the player's chat without a manual reload. Console: no errors.

### 2. Stale initiative + rolls
1. **Player tab** — visible during combat with one PC + one NPC in initiative.
2. Background the player tab.
3. **GM tab** — advance turn 2–3 times, deal damage to the NPC, end the round.
4. **Player tab** — return focus.

**Expected:** The initiative bar reflects the current active combatant, the NPC's WP/RP is current, the rolls feed shows the GM's recent rolls. Combat state matches the GM tab.

### 3. Stale NPC roster (state from the prior NPC-visibility ship)
1. **Player tab** — focused, NPC list shows revealed NPCs.
2. Background the player tab.
3. **GM tab** — create a new NPC, place it on the map (which auto-reveals via the trigger from the previous ship).
4. **Player tab** — return focus.

**Expected:** The newly-revealed NPC appears in the player's roster. (Both this ship and the trigger from the prior ship contribute: trigger flips `hidden_from_players`, this refetch pulls the new row.)

### 4. No double-fire on focus-without-background
1. **Player tab** — visible, scroll to a specific spot in the rolls feed.
2. Click another window (Tapestry tab still visible behind it on a multi-monitor setup) → click back to focus the Tapestry tab.

**Expected:** No state refetch (visibilitychange only fires on actual hidden→visible transitions, not focus changes). Scroll position preserved. If you see an unexpected refetch, the listener is on `focus` instead of `visibilitychange`.

### 5. No regression on first mount
1. Hard reload `/stories/<id>/table`.

**Expected:** Mount loads happen exactly once, not twice. Console: `[campaign_npcs] pgchange` etc. fire normally on subsequent events. The visibilitychange listener registers but doesn't fire (the tab was already visible at mount).

## Watch for

- **Console**: no AbortError or duplicate-refetch warnings.
- **Network tab on visible**: a small burst of `/rest/v1/character_states`, `/rest/v1/roll_log`, `/rest/v1/initiative_order`, `/rest/v1/campaign_npcs`, `/rest/v1/community_members`, `/rest/v1/npc_relationships`, `/rest/v1/chat_messages`. Same shape as the mount-time burst, fired once per visible event.
- **Battery**: refetch only fires on hidden→visible. A user who keeps the tab open all day pays nothing extra.

## Limitations / known gaps

- If the websocket truly *died* (TCP reset, not just paused), incoming events between the refetch and the next supabase-js heartbeat may still be missed until the heartbeat reconnects. State refetch covers what's visible; subsequent events flow normally once the socket is back.
- Tab-presence indicator ("connection healthy / stale" dot) deferred — would require a presence-heartbeat watchdog separate from realtime channels.
