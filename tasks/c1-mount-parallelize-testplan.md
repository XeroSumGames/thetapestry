# Testplan — C1 mount-fetch parallelization (`96a66b2`)

## What changed

The table page mount used to walk a 3-tier waterfall before any realtime channel was set up. C1 collapses it into two waves:

**Wave 1** (parallel): `auth.getUser()` + `campaigns.select(id)` — were sequential before, now fired together.

**Wave 2** (one big Promise.all of 11): `profiles.select(user.id)`, `profiles.select(gm_user_id)`, `campaign_members.select`, `loadEntries(id)`, `rollsFeed.refetch()`, `loadInitiative(id)`, `campaign_npcs.select`, `world_npcs.select`, `refreshMapTokenIds()`, `loadPlayerNpcCommunityMap(id)`, `character_states.kicked` (gated on !amGM via a resolved-placeholder when amGM).

The kick-check used to fire before the big batch; now it's part of the same parallel batch. Trade-off: a kicked player still pays the cost of the parallel batch before being redirected. Kick is a rare path; accepting that for the common-mount win.

`ensureCharacterStates` runs after Wave 2 because it needs `members`. `loadRevealedNpcs` runs in Wave 3 because it needs `cnpcs`. Both unchanged.

No new state, no new fetches — same data, fewer round-trips.

## What to test

### 1. Cold load as GM
1. Hard reload `/stories/<id>/table` as the GM (Ctrl-Shift-R / Cmd-Shift-R to bypass cache).
2. Page should render exactly as before — header bar, character entries, NPC roster, initiative bar, rolls feed, chat, tactical map button, etc.
3. **Open DevTools → Network tab BEFORE the reload.** Filter by `supabase.co`. Look at the timing waterfall:
   - You should see the auth and campaigns requests **start at the same time** (their bars overlap on the timeline).
   - Then a burst of ~9 requests starting together (profiles ×2, campaign_members, character_states, roll_log, initiative_order, campaign_npcs, world_npcs, scene_tokens-for-map, community_members, plus the kick-check skipped on GM).
   - Compared to the old waterfall, the time from page-mount to "first roll/init/chat visible" should drop noticeably — depends on round-trip latency, but expect 200–800ms shaved on cold loads.
4. **Console** — no errors. Specifically watch for:
   - `[campaign_npcs]` warnings
   - `[loadEntries]` errors
   - Any `silent RLS` warnings

### 2. Cold load as Player
1. Hard reload `/stories/<id>/table` as a player (a non-GM campaign member).
2. Same render check — character sheet, initiative bar (if combat), NPC roster (only revealed NPCs), chat, etc.
3. **Network tab** — same parallel-burst pattern, plus you should see the `character_states.kicked` request fire (gated on !amGM, runs for players only).
4. **Console** — `[kickCheck] myState:` log should appear with `myState: { kicked: false }` (or `null` if no row exists yet).

### 3. Kicked-player redirect (optional, only if you have a kicked player handy)
1. Mark a player as kicked: `UPDATE character_states SET kicked = true WHERE campaign_id = '<id>' AND user_id = '<kicked-user-id>';`
2. That player loads `/stories/<id>/table`.
3. **Expected:** alert("You have been removed from this session by the GM."), redirect to `/stories/<id>`. Same behavior as before C1.
4. Cleanup: `UPDATE character_states SET kicked = false WHERE ...;`

### 4. No-campaign redirect
1. Visit `/stories/<bogus-uuid>/table` directly.
2. **Expected:** redirect to `/stories`. (campaigns.select returns null, the `!camp` gate fires.)

### 5. No-auth redirect
1. Sign out.
2. Visit `/stories/<id>/table` directly.
3. **Expected:** redirect to `/login?redirect=/stories/<id>/table`. (Same as before — auth.getUser returns null, the `!user` gate fires.)

### 6. Interactive smoke after mount
After a successful mount, exercise the surfaces that read the data the parallel batch populated:
- **Initiative bar** — turn through a round (Start Combat → Next Turn → End Combat). Verify each transition.
- **Rolls feed** — fire a skill roll from a character sheet. Should appear in the Logs tab.
- **Chat** — send a message. Should appear in the Chat tab.
- **NPC roster** — open the GM Tools → NPCs tab. All NPCs should be there (GM); only revealed should be there (player).
- **Tactical map** — open via the header button. Tokens should be where they were.
- **Community panel** — open via Community ▾ → Dashboard. Member list should populate.

If everything in section 6 looks the same as before C1, the parallel refactor preserved behavior correctly.

## What to watch for

- **Race-related symptoms** — if any state setter that depends on a Wave-2 fetch fires too early, you'd see a flash of wrong data, then it'd correct itself. Check the rolls feed + initiative bar especially — those are most sensitive.
- **Realtime-channel gaps** — channels are set up AFTER Wave 2. If the page tries to broadcast before channels exist, broadcasts would silently no-op. Watch for any "first action after mount" that doesn't propagate to the second tab.
- **GM info bar** — the "GM: Xero" label in the header reads from `gmInfo` which is set after Wave 2. Should appear within the same render cycle as everything else.

## Rollback

If something is wrong, `git revert 96a66b2` undoes C1 cleanly. The change is contained to the `load()` function inside the table page mount useEffect — no schema changes, no other surfaces affected.
