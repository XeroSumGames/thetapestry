# Spec: `roll_log` Session-Archive (Y11-e)

Spec for the hunt-and-peck lane. Ruling logged in `tasks/decisions.md` 2026-05-20: stop clearing `roll_log` at session start. Instead tag rolls with `session_id`, filter the in-session feed by current session, and let prior sessions be browsed read-only. No roll data ever lost.

**Lane:** hunt-and-peck executes.

**Status:** SPEC 2026-05-20. No code yet.

---

## 1. Current state

At session start, `startSession()` in `app/stories/[id]/table/page.tsx` clears the feed:

```ts
supabase.from('roll_log').delete().eq('campaign_id', id)
supabase.from('chat_messages').delete().eq('campaign_id', id)
```

(Confirmed earlier in this session's reading of the startSession function around L3446. Hunt-and-peck: grep `from('roll_log').delete` in the table page to find the exact current line - it shifts with edits.)

The feed itself is read via a `useRollsFeed` hook (the table page abstracts roll_log access into a hook + `components/RollsFeed.tsx`; the table page body has no direct `roll_log` SELECT). The hook queries `roll_log` by `campaign_id`, newest-first.

**Net today:** every session start wipes the prior session's rolls + chat permanently. The Export Session Log feature (`22d75dc`) is the only way to keep a record, and it's a manual one-shot the GM has to remember.

---

## 2. Target state

- `roll_log` gains a `session_id` column.
- Rolls written during a session carry that session's id.
- The session-start `DELETE FROM roll_log` is removed.
- The in-session feed filters by the CURRENT `session_id` (so the live feed still looks clean - only this session's rolls).
- Prior sessions are browsable read-only at `/stories/[id]/sessions/<session_id>` (the sessions page already exists at `app/stories/[id]/sessions/page.tsx`; extend it with a per-session feed view).

Same treatment optional for `chat_messages` (Xero ruled on roll_log specifically; chat_messages can follow the same pattern or stay as-is - flag for Xero if scope expands).

---

## 3. Schema changes

```sql
-- sql/roll-log-session-id-2026-05-DD.sql (idempotent)
ALTER TABLE public.roll_log
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

-- Feed query is "this campaign + this session, newest first."
CREATE INDEX IF NOT EXISTS idx_roll_log_session_created
  ON public.roll_log (session_id, created_at DESC);

-- Keep the existing campaign+created index for the cross-session browse.
-- (idx_roll_log_campaign_created already exists per hot-table-indexes-2026-05-17.sql)
```

`ON DELETE SET NULL`: if a session row is deleted, its rolls survive with `session_id = NULL` (orphaned but not lost). Aligns with the "never lose roll data" intent.

---

## 4. Code changes

### 4a. Stamp `session_id` on every roll write

Every `roll_log` INSERT during a session needs the current `session_id`. The table page already tracks `sessionCount` + has the active session row. Add `session_id` to the insert payload at every `from('roll_log').insert(...)` site.

**Finding the sites:** there are many roll_log insert sites (the 49-site OUTCOME migration touched them). They funnel through `saveRollToLog` (per the decomposition plan's inventory, `saveRollToLog` at ~L4740). If all inserts go through `saveRollToLog`, add `session_id` there ONCE. Verify that's the single choke point; if some inserts bypass it, stamp those too.

The current active session id: query `sessions` for the campaign's active row (`session_status = 'active'`), OR track it in state when `startSession` runs. Recommend: `startSession` already creates the session row (`supabase.from('sessions').insert(...)`); capture the returned `id` into a `currentSessionIdRef` and read it in `saveRollToLog`.

### 4b. Remove the session-start DELETE

In `startSession`, delete these two lines (or comment with rationale):
```ts
supabase.from('roll_log').delete().eq('campaign_id', id)  // REMOVE
```
Keep the `setSessionCount` + session row insert. The feed clears VISUALLY via the filter change (4c), not via a DB wipe.

### 4c. Filter the live feed by current session

The `useRollsFeed` hook's query changes from:
```ts
.from('roll_log').select('*').eq('campaign_id', id).order('created_at', { ascending: false })
```
to additionally filter by the current session:
```ts
.eq('session_id', currentSessionId)
```

**Edge case - rolls before sessions existed:** historical rolls have `session_id = NULL`. They won't show in the live feed (which filters by current session). That's fine - they're browsable via the "all rolls" or per-session view. Decide whether a "pre-session-tracking" bucket is worth surfacing (probably not).

### 4d. Per-session browse view

Extend `app/stories/[id]/sessions/page.tsx`: each session row links to a read-only feed of that session's rolls (`from('roll_log').eq('session_id', sid)`). Reuse the `RollsFeed` rendering in read-only mode (no action buttons).

### 4e. chat_messages (scope decision)

Xero ruled on roll_log. `chat_messages` has the identical session-start DELETE. Options:
- Mirror the change (add `session_id` to chat_messages, same treatment).
- Leave chat_messages clearing as-is (chat is more ephemeral than rolls).

**Flag for Xero before shipping 4e.** Default: mirror it for consistency, but confirm.

---

## 5. Migration phases

### RLA1: schema (0.5 session)
Apply Section 3 SQL. Verify column + index. No behavior change.

### RLA2: stamp session_id (0.5 session)
Capture `currentSessionIdRef` in `startSession`; add `session_id` to `saveRollToLog`. Verify: new rolls during a session carry the session_id (SQL check). Old rolls stay NULL. **Don't change the feed query or remove the DELETE yet** - rolls are stamped but behavior unchanged.

### RLA3: filter feed + remove DELETE (1 session)
Change `useRollsFeed` to filter by `currentSessionId`. Remove the session-start `roll_log` DELETE. Verify: starting a new session shows an empty feed (filtered, not wiped); prior session's rolls still in the DB (SQL check).

**Gate:** start session -> roll -> end session -> start new session -> feed is clean -> query DB confirms prior rolls survive.

### RLA4: per-session browse (1 session)
Extend the sessions page with the read-only per-session feed. Verify: open a prior session, see its rolls rendered read-only.

### RLA5: chat_messages (Xero decision, optional)

---

## 6. Backfill plan

Existing `roll_log` rows have `session_id = NULL` (column default). They're "pre-session-tracking" rolls. Options:
- **Leave NULL.** They don't show in any session's feed but are queryable. Simplest. Recommended.
- **Best-effort backfill** by matching `roll_log.created_at` against `sessions.started_at`/`ended_at` windows. Fragile (sessions may overlap or have gaps). Only do this if Xero wants historical rolls bucketed.

Recommend: leave NULL + document. No data lost; just not session-bucketed for pre-migration rolls.

---

## 7. Risks

### RLA-R1: missed insert site = roll without session_id
If a roll_log insert bypasses `saveRollToLog`, it gets `session_id = NULL` and vanishes from the live feed. **Mitigation:** confirm `saveRollToLog` is the single insert choke point in RLA2; grep `from('roll_log').insert` to verify. Stamp any stragglers.

### RLA-R2: feed shows empty after the filter change if session_id isn't being set
If RLA3 ships before RLA2 is verified, the feed filters by a session_id that no rolls carry = blank feed mid-session. **Mitigation:** RLA2 fully verified (rolls carry session_id) BEFORE RLA3.

### RLA-R3: the session-start DELETE removal could surface old behavior
Some code may assume roll_log is empty at session start. **Mitigation:** grep for any logic that counts roll_log rows or assumes emptiness. The feed is the main consumer; it's getting the session filter.

### RLA-R4: storage growth
roll_log now grows unbounded (no more session-start wipe). At alpha scale this is negligible. At paid-user scale, consider archiving rolls older than N sessions to cold storage. **Mitigation:** out of scope now; note for the performance-tier work.

---

## 8. Smoke test matrix

| Step | Test |
|---|---|
| Schema | `session_id` column + index exist. |
| Stamp | New roll during a session carries the active session_id. |
| Feed filter | New session = empty live feed; prior rolls survive in DB. |
| No data loss | After 3 sessions, all 3 sessions' rolls queryable by session_id. |
| Browse | Prior session's feed renders read-only on the sessions page. |
| chat_messages | (if RLA5) same pattern verified, OR confirmed left as-is. |

---

## 9. Maintenance

Update `tasks/ops-soft-delete-stance-2026-05-19.md` to move `roll_log` out of "session-scope cleared" into "session-tagged, retained." Update the Risk Register `roll_log writer path` entry (currently YELLOW-held) - this change touches it, so re-verify after the next playtest.
