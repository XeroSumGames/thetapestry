# Perf A1 — Column-Pick + Debounce · 2026-05-14

## Fix 1: Column-pick results

### `characters` table (character-sheet/page.tsx line 34)
`select('id,user_id,name,created_at,data')`

Reasoning: `id` is used throughout for updates/callbacks; `user_id` checked at line 48 for `isMySheet`; `name` used in the roll-request BroadcastChannel label and in CharacterCard; `created_at` required by CharacterCard's TypeScript `character` prop interface (line 85 of CharacterCard.tsx); `data` is the JSONB blob holding everything (skills, stats, notes, progression log, photoDataUrl, weapons). Nothing else is accessed in the file or in CharacterCard's typed interface.

### `character_states` table (character-sheet/page.tsx line 52)
`select('id,wp_current,wp_max,rp_current,rp_max,stress,insight_dice,morality,cdp,death_countdown,incap_rounds')`

Reasoning: exact match of every field destructured into `LiveState` at lines 55–61, plus `id` for `setStateId`. The realtime UPDATE handler at line 83 receives `payload.new` from postgres (all columns) — that path is unaffected by this select change.

### `campaign-sheet/page.tsx` — no change needed
`loadVehicles` already does `select('vehicles')` and the initial load already uses `select('name, gm_user_id, clock, start_canon_day')`. The task description referenced a third select('*') but it had already been column-picked.

---

## Fix 2: Debounce implementation

**File:** `app/campaign-sheet/page.tsx` — lines 80–155 (post-edit)

`refetchTimerRef` (useRef) holds the pending timer ID. `scheduleRefetch` (useCallback, deps `[loadParty, loadPending]`) clears any existing timer and sets a 200ms one that calls both loaders. All three realtime handlers that previously called `loadParty()` or `loadPending()` directly now call `scheduleRefetch()` instead:
- `broadcastCh` `clock_advanced` handler (was `await Promise.all([loadParty(), loadPending()])`)
- `pgCh` `character_states` handler (was `() => { loadParty() }`)
- `pgCh` `campaign_events` handler (was `() => { loadPending() }`)

`loadVehicles` is still called directly from the campaigns UPDATE handler (vehicle array changes are rare and structurally separate).

**Cleanup** (line 219): `if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current)` fires before `removeChannel` calls on unmount.

`loadParty` and `loadPending` are wrapped in `useCallback([supabase, campaignId])` so `scheduleRefetch`'s memoization is stable. `scheduleRefetch` is added to the `useEffect` dep array.

---

## Intentionally not changed

- `loadVehicles` left as a plain async function — not on the debounced path, called for a distinct data type (vehicle array diff), no burst scenario.
- Pre-existing TS2322 prop-type mismatches at lines 345/356/369 in campaign-sheet JSX — out of scope, pre-date this change.
- No changes to CharacterCard, ProgressionLog, or any other component.

---

## Smoke-test plan

1. **Party data still loads:** Open the campaign sheet (`/campaign-sheet?c=<id>`). Confirm Party Status shows all PCs with correct WP/RP/Stress, Pending Effects lists any active heals, and Vehicles panel is populated. Open a character sheet (`/character-sheet?c=<id>&char=<id>`) — name, stats bar, session notes, and progression log must all render.

2. **Realtime still propagates (debounced):** As GM, advance the clock by 1h. Party Status and Pending Effects should update within ~400ms (200ms debounce + network). In the browser network tab, confirm only one pair of XHR/fetch calls fires per advance rather than N calls for N simultaneous DB events.
